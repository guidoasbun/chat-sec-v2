# ── Subnet group (private subnets only) ──────────────────────────────────────

resource "aws_elasticache_subnet_group" "main" {
  name       = "${var.app_name}-redis-subnet-group"
  subnet_ids = var.private_subnet_ids

  tags = {
    Name = "${var.app_name}-redis-subnet-group"
  }
}

# ── Security group (only allow Redis port from within VPC) ───────────────────

resource "aws_security_group" "redis" {
  name        = "${var.app_name}-redis-sg"
  description = "Allow Redis traffic from within VPC only"
  vpc_id      = var.vpc_id

  ingress {
    description = "Redis from VPC"
    from_port   = 6379
    to_port     = 6379
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/16"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.app_name}-redis-sg"
  }
}

# ── Redis cluster ─────────────────────────────────────────────────────────────

resource "aws_elasticache_replication_group" "main" {
  replication_group_id = "${var.app_name}-redis"
  description          = "Redis backplane for SignalR"

  node_type            = "cache.t4g.micro"
  num_cache_clusters   = 1
  port                 = 6379

  subnet_group_name  = aws_elasticache_subnet_group.main.name
  security_group_ids = [aws_security_group.redis.id]

  at_rest_encryption_enabled  = true
  transit_encryption_enabled  = true
  automatic_failover_enabled  = false

  tags = {
    Name = "${var.app_name}-redis"
  }
}
