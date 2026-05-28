DOCKER_COMPOSE = docker-compose -f infrastructure/docker/docker-compose.yml

.PHONY: up down logs ps dev

up:
	$(DOCKER_COMPOSE) up -d

down:
	$(DOCKER_COMPOSE) down

logs:
	$(DOCKER_COMPOSE) logs -f

ps:
	$(DOCKER_COMPOSE) ps

dev:
	$(DOCKER_COMPOSE) up -d
	node_modules/.bin/next dev apps/web
