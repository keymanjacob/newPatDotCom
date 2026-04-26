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

variable "api_location" {
  description = "Azure region for backend resources"
  type        = string
  default     = "westus2"
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

variable "neon_database_url" {
  description = "Neon PostgreSQL connection string"
  type        = string
  sensitive   = true
}

variable "container_image" {
  description = <<-EOT
    Full Docker image reference pushed to GHCR by the deploy-api workflow.
    Format: ghcr.io/<github-owner>/baby-tracker-api:latest
  EOT
  type    = string
  default = "ghcr.io/placeholder/baby-tracker-api:latest"
}

variable "ghcr_username" {
  description = "GitHub username — used by the Container App to pull the image from GHCR"
  type        = string
}

variable "ghcr_pat" {
  description = <<-EOT
    GitHub Personal Access Token with read:packages scope.
    Create at: https://github.com/settings/tokens/new?scopes=read:packages
    Used only by the Container App to authenticate against ghcr.io.
  EOT
  type      = string
  sensitive = true
}
