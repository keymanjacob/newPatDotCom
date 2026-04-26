output "static_web_app_url" {
  description = "URL of the React PWA"
  value       = "https://${azurerm_static_web_app.ui.default_host_name}"
}

output "static_web_app_deployment_token" {
  description = "GitHub Actions deployment token for the Static Web App (keep secret)"
  value       = azurerm_static_web_app.ui.api_key
  sensitive   = true
}

output "container_app_url" {
  description = <<-EOT
    URL of the Container API — paste into packages/client/.env.production:
      VITE_API_URL=<this value>
    Then push to main to trigger the frontend redeploy.
  EOT
  value = "https://${azurerm_container_app.api.ingress[0].fqdn}"
}

output "web_pubsub_connection_string" {
  description = "Web PubSub connection string — already injected into the Container App"
  value       = azurerm_web_pubsub.pubsub.primary_connection_string
  sensitive   = true
}

output "application_insights_connection_string" {
  description = "Application Insights connection string"
  value       = azurerm_application_insights.insights.connection_string
  sensitive   = true
}
