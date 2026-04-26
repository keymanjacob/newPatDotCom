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
  description = "Azure region for backend resources (Functions + Container App)"
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

variable "container_image" {
  description = <<-EOT
    Full Docker image reference for the container API server.
    Build and push with:
      docker build -f packages/server-container/Dockerfile -t <registry>/baby-tracker-api:latest .
      docker push <registry>/baby-tracker-api:latest
    Examples:
      ghcr.io/<github-user>/baby-tracker-api:latest
      docker.io/<dockerhub-user>/baby-tracker-api:latest
  EOT
  type    = string
  default = "ghcr.io/placeholder/baby-tracker-api:latest"
}
