# ElastiCache Module - Redis Cluster

# Subnet Group (required for ElastiCache)
resource "aws_elasticache_subnet_group" "redis" {
  name       = "${var.project_name}-${var.environment}-redis-subnet-group"
  subnet_ids = var.private_subnet_ids
  
  tags = {
    Name = "${var.project_name}-${var.environment}-redis-subnet-group"
  }
}

# Parameter Group for Redis 7.x
resource "aws_elasticache_parameter_group" "redis" {
  name   = "${var.project_name}-${var.environment}-redis-params"
  family = "redis7"
  
  parameter {
    name  = "maxmemory-policy"
    value = "allkeys-lru"  # Evict least recently used keys when memory full
  }
  
  tags = {
    Name = "${var.project_name}-${var.environment}-redis-params"
  }
}

# Redis Cluster
resource "aws_elasticache_cluster" "redis" {
  cluster_id           = "${var.project_name}-${var.environment}-redis"
  engine               = "redis"
  engine_version       = "7.1"
  node_type            = "cache.t3.micro"  # Free tier eligible
  num_cache_nodes      = 1
  parameter_group_name = aws_elasticache_parameter_group.redis.name
  subnet_group_name    = aws_elasticache_subnet_group.redis.name
  security_group_ids   = [var.security_group_id]
  port                 = 6379
  
  # Automatic backups (free within limits)
  snapshot_retention_limit = 1
  snapshot_window          = "03:00-04:00"
  
  # Maintenance window
  maintenance_window = "sun:04:00-sun:05:00"
  
  tags = {
    Name = "${var.project_name}-${var.environment}-redis"
  }
}
