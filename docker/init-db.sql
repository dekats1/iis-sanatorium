-- Выполняется один раз при первом старте контейнера PostgreSQL: по БД и роли на каждый сервис (database-per-service).
CREATE ROLE core     LOGIN PASSWORD 'core';
CREATE ROLE pricing  LOGIN PASSWORD 'pricing';
CREATE ROLE payment  LOGIN PASSWORD 'payment';
CREATE DATABASE sanatorium_core    OWNER core;
CREATE DATABASE sanatorium_pricing OWNER pricing;
CREATE DATABASE sanatorium_payment OWNER payment;
