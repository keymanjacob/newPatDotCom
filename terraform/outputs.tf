output "static_web_app_url" {
  description = "URL of the deployed React PWA"
  value       = "https://${azurerm_static_web_app.ui.default_host_name}"
}

output "static_web_app_deployment_token" {
  description = "GitHub Actions deployment token for the Static Web App (keep secret)"
  value       = azurerm_static_web_app.ui.api_key
  sensitive   = true
}

# ── Container API (primary) ───────────────────────────────────────────────────

output "container_app_url" {
  description = <<-EOT
    URL of the Container App API — copy this into packages/client/.env.production:
      VITE_API_URL=<this value>
    Then rebuild the client before pushing to trigger the SWA deploy.
  EOT
  value       = "https://${azurerm_container_app.api.ingress[0].fqdn}"
}

# ── Legacy: Azure Functions (rollback target) ─────────────────────────────────

output "function_app_url" {
  description = "URL of the legacy Azure Functions API (kept for rollback)"
  value       = "https://${azurerm_linux_function_app.api.default_hostname}"
}

# ── Shared ────────────────────────────────────────────────────────────────────

output "web_pubsub_hostname" {
  description = "Azure Web PubSub hostname (informational)"
  value       = azurerm_web_pubsub.pubsub.hostname
}

output "web_pubsub_connection_string" {
  description = "Web PubSub primary connection string — already injected into both API targets"
  value       = azurerm_web_pubsub.pubsub.primary_connection_string
  sensitive   = true
}

output "application_insights_connection_string" {
  description = "Application Insights connection string — injected into Function App"
  value       = azurerm_application_insights.insights.connection_string
  sensitive   = true
}
