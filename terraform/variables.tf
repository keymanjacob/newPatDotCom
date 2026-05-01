variable "resource_group_name" {
  description = "Name of the Azure Resource Group"
  type        = string
  default     = "rg-fan-holdings"
}

variable "location" {
  description = "Azure region for the resource group"
  type        = string
  default     = "centralus"
}

variable "static_web_app_location" {
  description = "Azure region for the Static Web App"
  type        = string
  default     = "centralus"
}

variable "app_name" {
  description = "Base name for all Azure resources"
  type        = string
  default     = "baby-tracker-app"
  validation {
    condition     = can(regex("^[a-z0-9]+(-[a-z0-9]+)*$", var.app_name))
    error_message = "App name must be lowercase alphanumeric and dashes only."
  }
}
