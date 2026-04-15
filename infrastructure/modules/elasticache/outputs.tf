output "redis_url" {
  description = "Redis primary endpoint URL for SignalR backplane"
  value       = "${aws_elasticache_replication_group.main.primary_endpoint_address}:6379,ssl=true,abortConnect=false"
}
