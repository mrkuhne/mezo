# Runtime image for the mezo backend.
#
# The JAR is built natively first (`./mvnw clean package -DskipTests`) because the
# build needs the OpenAPI contract at ../api and the dev machine already has Java 21.
# This image only RUNS the (architecture-independent) JAR on an amd64 JRE, matching
# the x86 k3s node. Build it explicitly for that platform:
#
#   ./mvnw -B clean package -DskipTests                 # in backend/, produces target/*.jar
#   docker buildx build --platform linux/amd64 \
#     -t ghcr.io/mrkuhne/mezo-backend:<tag> backend --push
#
FROM eclipse-temurin:21-jre
WORKDIR /app

# Spring Boot fat JAR produced by `mvn package`.
COPY target/*.jar app.jar

# Matches server.port (MEZO_PORT default 8090).
EXPOSE 8090

# DB URL, credentials, JWT secret and active profile are injected at runtime
# via env/Secret in the Kubernetes Deployment — nothing baked into the image.
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
