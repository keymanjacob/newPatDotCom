variable "resource_group_name" {
  description = "Name of the Azure Resource Group"
  type        = string
  default     = "baby-tracker-rg"
}

variable "location" {
  description = "Azure region to deploy resources to"
  type        = string
  default     = "eastus"
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
