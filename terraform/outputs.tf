output "static_web_app_url" {
  description = "URL of the React PWA"
  value       = "https://${azurerm_static_web_app.ui.default_host_name}"
}

output "static_web_app_deployment_token" {
  description = "GitHub Actions deployment token for the Static Web App (keep secret)"
  value       = azurerm_static_web_app.ui.api_key
  sensitive   = true
}
