variable "resource_group_name" {
  description = "Name of the Azure Resource Group"
  type        = string
  default     = "rg-fan-holdings"
}

variable "location" {
  description = "Azure region to deploy resources to"
  type        = string
  default     = "centralus"
}

variable "static_web_app_location" {
  description = "Azure region specifically for the Static Web App"
  type        = string
  default     = "centralus"
}

variable "api_location" {
  description = "Azure region specifically for the Backend API"
  type        = string
  default     = "westus2"
}

variable "app_name" {
  description = "Base name for Azure resources"
  type        = string
  default     = "baby-tracker-app"
  validation {
    condition     = can(regex("^[a-z0-9]+(-[a-z0-9]+)*$", var.app_name))
    error_message = "App name must be lowercase alphanumeric and dashes only."
  }
}

variable "neon_database_url" {
  description = "Connection string for Neon PostgreSQL database"
  type        = string
  sensitive   = true
}
