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

# Resource Group
resource "azurerm_resource_group" "rg" {
  name     = var.resource_group_name
  location = var.location
}

# Static Web App (Free Tier) for the React UI
resource "azurerm_static_web_app" "ui" {
  name                = "${var.app_name}-ui"
  resource_group_name = azurerm_resource_group.rg.name
  location            = "eastus2" # Note: SWA is only available in certain locations
  sku_tier            = "Free"
  sku_size            = "Free"
}

# Storage Account for Azure Functions
resource "azurerm_storage_account" "storage" {
  name                     = replace("${var.app_name}sa", "-", "")
  resource_group_name      = azurerm_resource_group.rg.name
  location                 = azurerm_resource_group.rg.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
}

# App Service Plan for Azure Functions (Consumption Free Tier)
resource "azurerm_service_plan" "asp" {
  name                = "${var.app_name}-plan"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  os_type             = "Linux"
  sku_name            = "Y1"
}

# Azure Linux Function App
resource "azurerm_linux_function_app" "api" {
  name                       = "${var.app_name}-api"
  resource_group_name        = azurerm_resource_group.rg.name
  location                   = azurerm_resource_group.rg.location
  service_plan_id            = azurerm_service_plan.asp.id
  storage_account_name       = azurerm_storage_account.storage.name
  storage_account_access_key = azurerm_storage_account.storage.primary_access_key

  site_config {
    application_stack {
      node_version = "20"
    }
    cors {
      allowed_origins = [
        "http://localhost:5173", # Local client
        "http://localhost:5174",
        "https://${azurerm_static_web_app.ui.default_host_name}" # Production client
      ]
      support_credentials = false
    }
  }

  app_settings = {
    "FUNCTIONS_WORKER_RUNTIME" = "node"
    "WEBSITE_NODE_DEFAULT_VERSION" = "~20"
    "DATABASE_URL"             = var.neon_database_url
  }
}
