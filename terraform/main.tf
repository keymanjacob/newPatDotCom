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

resource "azurerm_resource_group" "rg" {
  name     = var.resource_group_name
  location = var.location

  lifecycle {
    prevent_destroy = true
  }
}

resource "azurerm_log_analytics_workspace" "logs" {
  name                = "${var.app_name}-logs"
  resource_group_name = azurerm_resource_group.rg.name
  location            = var.api_location
  sku                 = "PerGB2018"
  retention_in_days   = 30
}

resource "azurerm_application_insights" "insights" {
  name                = "${var.app_name}-insights"
  resource_group_name = azurerm_resource_group.rg.name
  location            = var.api_location
  workspace_id        = azurerm_log_analytics_workspace.logs.id
  application_type    = "web"
}

# Azure Web PubSub (Free F1) — real-time broadcast for cross-device sync
resource "azurerm_web_pubsub" "pubsub" {
  name                = "${var.app_name}-pubsub"
  resource_group_name = azurerm_resource_group.rg.name
  location            = var.api_location
  sku                 = "Free_F1"
  capacity            = 1
}

# ── Frontend ──────────────────────────────────────────────────────────────────

resource "azurerm_static_web_app" "ui" {
  name                = "${var.app_name}-ui"
  resource_group_name = azurerm_resource_group.rg.name
  location            = var.static_web_app_location
  sku_tier            = "Free"
  sku_size            = "Free"
}

# ── Container API ─────────────────────────────────────────────────────────────

resource "azurerm_container_app_environment" "env" {
  name                       = "${var.app_name}-container-env"
  resource_group_name        = azurerm_resource_group.rg.name
  location                   = var.api_location
  log_analytics_workspace_id = azurerm_log_analytics_workspace.logs.id
}

resource "azurerm_container_app" "api" {
  name                         = "${var.app_name}-container"
  container_app_environment_id = azurerm_container_app_environment.env.id
  resource_group_name          = azurerm_resource_group.rg.name
  revision_mode                = "Single"

  # GHCR credentials — Container App uses these to pull the image
  registry {
    server               = "ghcr.io"
    username             = var.ghcr_username
    password_secret_name = "ghcr-pat"
  }

  secret {
    name  = "ghcr-pat"
    value = var.ghcr_pat
  }

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
