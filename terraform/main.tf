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

# Resource Group — imported, shared with fan-api and fan-ui.
# NEVER destroy this. lifecycle guard prevents accidental deletion
# of existing projects in this resource group.
resource "azurerm_resource_group" "rg" {
  name     = var.resource_group_name
  location = var.location

  lifecycle {
    prevent_destroy = true  # Protects fan-api, fan-ui, and all other projects
  }
}

# Static Web App (Free Tier) for the React UI
resource "azurerm_static_web_app" "ui" {
  name                = "${var.app_name}-ui"
  resource_group_name = azurerm_resource_group.rg.name
  location            = var.static_web_app_location
  sku_tier            = "Free"
  sku_size            = "Free"
}

# Storage Account for Azure Functions
resource "azurerm_storage_account" "storage" {
  name                     = replace("${var.app_name}sa", "-", "")
  resource_group_name      = azurerm_resource_group.rg.name
  location                 = var.api_location
  account_tier             = "Standard"
  account_replication_type = "LRS"
}

# App Service Plan for Azure Functions (Consumption Free Tier)
resource "azurerm_service_plan" "asp" {
  name                = "${var.app_name}-plan"
  resource_group_name = azurerm_resource_group.rg.name
  location            = var.api_location
  os_type             = "Linux"
  sku_name            = "Y1"
}

# Log Analytics Workspace — feeds Application Insights (first 5 GB/month free)
resource "azurerm_log_analytics_workspace" "logs" {
  name                = "${var.app_name}-logs"
  resource_group_name = azurerm_resource_group.rg.name
  location            = var.api_location
  sku                 = "PerGB2018"
  retention_in_days   = 30
}

# Application Insights — enables invocation logs in the Azure Portal
resource "azurerm_application_insights" "insights" {
  name                = "${var.app_name}-insights"
  resource_group_name = azurerm_resource_group.rg.name
  location            = var.api_location
  workspace_id        = azurerm_log_analytics_workspace.logs.id
  application_type    = "web"
}

# Azure Web PubSub Service (Free Tier F1)
# Provides the real-time WebSocket broadcast channel for cross-device sync.
# Free tier limits: 20 concurrent connections, 20,000 messages/day.
# A family of 4 logging ~20 events/day uses ~60 messages/day — well within limits.
resource "azurerm_web_pubsub" "pubsub" {
  name                = "${var.app_name}-pubsub"
  resource_group_name = azurerm_resource_group.rg.name
  location            = var.api_location
  sku                 = "Free_F1"
  capacity            = 1
}

# Azure Linux Function App
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
    # CORS is handled exclusively by the Express app (cors() middleware with origin: "*").
    # Do NOT configure CORS here — Azure Functions platform CORS adds its own
    # Access-Control-Allow-Origin header, which duplicates the one Express sets,
    # causing Chrome to reject all cross-origin responses with a CORS error.
  }

  app_settings = {
    "FUNCTIONS_WORKER_RUNTIME"             = "node"
    "WEBSITE_NODE_DEFAULT_VERSION"         = "~20"
    # Required for Azure Functions v4 Node.js SDK (code-based function registration)
    "AzureWebJobsFeatureFlags"             = "EnableWorkerIndexing"
    "DATABASE_URL"                         = var.neon_database_url
    "AZURE_WEB_PUBSUB_CONNECTION_STRING"   = azurerm_web_pubsub.pubsub.primary_connection_string
    # Application Insights — enables invocation logs in the portal
    "APPINSIGHTS_INSTRUMENTATIONKEY"       = azurerm_application_insights.insights.instrumentation_key
    "APPLICATIONINSIGHTS_CONNECTION_STRING" = azurerm_application_insights.insights.connection_string
  }
}
