terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.100.0"
    }
  }
}

provider "azurerm" {
  features {}
}

# ── Shared Foundation ─────────────────────────────────────────────────────────

# Resource Group — imported, shared with fan-api and fan-ui.
# NEVER destroy this. lifecycle guard prevents accidental deletion.
resource "azurerm_resource_group" "rg" {
  name     = var.resource_group_name
  location = var.location

  lifecycle {
    prevent_destroy = true
  }
}

# Log Analytics Workspace — shared by App Insights + Container App environment
resource "azurerm_log_analytics_workspace" "logs" {
  name                = "${var.app_name}-logs"
  resource_group_name = azurerm_resource_group.rg.name
  location            = var.api_location
  sku                 = "PerGB2018"
  retention_in_days   = 30
}

# Application Insights — enables invocation logs for the Function App
resource "azurerm_application_insights" "insights" {
  name                = "${var.app_name}-insights"
  resource_group_name = azurerm_resource_group.rg.name
  location            = var.api_location
  workspace_id        = azurerm_log_analytics_workspace.logs.id
  application_type    = "web"
}

# Azure Web PubSub (Free Tier F1) — real-time broadcast for cross-device sync
resource "azurerm_web_pubsub" "pubsub" {
  name                = "${var.app_name}-pubsub"
  resource_group_name = azurerm_resource_group.rg.name
  location            = var.api_location
  sku                 = "Free_F1"
  capacity            = 1
}

# ── Frontend ──────────────────────────────────────────────────────────────────

# Static Web App (Free Tier) for the React PWA
resource "azurerm_static_web_app" "ui" {
  name                = "${var.app_name}-ui"
  resource_group_name = azurerm_resource_group.rg.name
  location            = var.static_web_app_location
  sku_tier            = "Free"
  sku_size            = "Free"
}

# ── Container API (primary — replaces Azure Functions) ────────────────────────

# Container App Environment — the managed runtime for Container Apps.
# Reuses the shared Log Analytics workspace for consolidated logging.
resource "azurerm_container_app_environment" "env" {
  name                       = "${var.app_name}-container-env"
  resource_group_name        = azurerm_resource_group.rg.name
  location                   = var.api_location
  log_analytics_workspace_id = azurerm_log_analytics_workspace.logs.id
}

# Container App — runs the Docker image built from packages/server-container.
# Consumption plan: scales to zero when idle, ~180k vCPU-sec free/month.
# For a family tracker logging ~20 events/day this stays within the free tier.
resource "azurerm_container_app" "api" {
  name                         = "${var.app_name}-container"
  container_app_environment_id = azurerm_container_app_environment.env.id
  resource_group_name          = azurerm_resource_group.rg.name
  revision_mode                = "Single"

  # Secrets are injected as env vars — never appear in the container spec plaintext
  secret {
    name  = "database-url"
    value = var.neon_database_url
  }

  secret {
    name  = "pubsub-connection-string"
    value = azurerm_web_pubsub.pubsub.primary_connection_string
  }

  template {
    min_replicas = 0  # Scale to zero when idle
    max_replicas = 2

    container {
      name   = "api"
      image  = var.container_image
      cpu    = 0.25
      memory = "0.5Gi"

      env {
        name  = "NODE_ENV"
        value = "production"
      }
      env {
        name  = "PORT"
        value = "3001"
      }
      # Allow only the SWA origin in production
      env {
        name  = "CORS_ORIGINS"
        value = "https://${azurerm_static_web_app.ui.default_host_name}"
      }
      env {
        name        = "DATABASE_URL"
        secret_name = "database-url"
      }
      env {
        name        = "AZURE_WEB_PUBSUB_CONNECTION_STRING"
        secret_name = "pubsub-connection-string"
      }
    }
  }

  ingress {
    external_enabled = true
    target_port      = 3001
    transport        = "http"

    traffic_weight {
      percentage      = 100
      latest_revision = true
    }
  }
}

# ── Legacy: Azure Functions API (kept for rollback) ───────────────────────────
# The Container App above is the primary API target.
# This Function App can be removed once the container deployment is stable.

resource "azurerm_storage_account" "storage" {
  name                     = replace("${var.app_name}sa", "-", "")
  resource_group_name      = azurerm_resource_group.rg.name
  location                 = var.api_location
  account_tier             = "Standard"
  account_replication_type = "LRS"
}

resource "azurerm_service_plan" "asp" {
  name                = "${var.app_name}-plan"
  resource_group_name = azurerm_resource_group.rg.name
  location            = var.api_location
  os_type             = "Linux"
  sku_name            = "Y1"
}

resource "azurerm_linux_function_app" "api" {
  name                       = "${var.app_name}-api"
  resource_group_name        = azurerm_resource_group.rg.name
  location                   = var.api_location
  service_plan_id            = azurerm_service_plan.asp.id
  storage_account_name       = azurerm_storage_account.storage.name
  storage_account_access_key = azurerm_storage_account.storage.primary_access_key

  site_config {
    application_stack {
      node_version = "20"
    }
    # CORS is handled by Express middleware — do not configure here.
    # Azure Functions platform CORS would duplicate the header and break Chrome.
  }

  app_settings = {
    "FUNCTIONS_WORKER_RUNTIME"              = "node"
    "WEBSITE_NODE_DEFAULT_VERSION"          = "~20"
    "AzureWebJobsFeatureFlags"              = "EnableWorkerIndexing"
    "DATABASE_URL"                          = var.neon_database_url
    "AZURE_WEB_PUBSUB_CONNECTION_STRING"    = azurerm_web_pubsub.pubsub.primary_connection_string
    "APPINSIGHTS_INSTRUMENTATIONKEY"        = azurerm_application_insights.insights.instrumentation_key
    "APPLICATIONINSIGHTS_CONNECTION_STRING" = azurerm_application_insights.insights.connection_string
  }
}
