-- Fixed integration-test database (company pattern: tests run against a real,
-- inspectable Postgres DB; Liquibase migrates it on the first test run).
CREATE DATABASE mezo_test OWNER mezo;
