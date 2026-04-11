output "static_web_app_url" {
  description = "The URL of the deployed React application frontend"
  value       = "https://${azurerm_static_web_app.ui.default_host_name}"
}

output "function_app_url" {
  description = "The URL of the Azure Functions backend API"
  value       = "https://${azurerm_linux_function_app.api.default_hostname}"
}

output "static_web_app_deployment_token" {
  description = "Deployment token for GitHub Actions (Keep Secret!)"
  value       = azurerm_static_web_app.ui.api_key
  sensitive   = true
}
