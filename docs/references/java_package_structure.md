# Java Package Structure

## Base Pattern

```
io.mrkuhne.mezo/
├── feature/
│   └── {featureName}/
│       ├── controller/   → *Controller (implements the generated <Tag>Api)
│       ├── service/      → *Service
│       ├── repository/   → *Repository
│       ├── entity/       → *Entity
│       ├── dto/          → internal *Dto only — boundary Request/Response types are GENERATED (api.dto)
│       └── mapper/       → *Mapper (MapStruct)
└── techcore/
    ├── configuration/
    ├── security/
    ├── exception/
    └── util/
```

## Rules

- **Feature-based packages**, never layer-based at root
- One class = one responsibility
- Sub-features for complex features: `feature/payment/residential/`
- Max 4-5 levels deep
- No "common" or "misc" packages
- No circular dependencies between feature packages

## Feature vs Techcore

| Question | Feature | Techcore |
|---|---|---|
| Contains business logic? | Yes | No |
| Reusable across features? | No | Yes |
| Changes frequently? | Yes | Rarely |

## Naming Conventions

| Layer | Suffix | Example |
|---|---|---|
| Controller | `*Controller` | `UserController` |
| Service | `*Service` | `UserService`, `UserValidationService` |
| Repository | `*Repository` | `UserRepository` |
| Entity | `*Entity` | `UserEntity` |
| DTO | `*Dto`, `*Request`, `*Response` | `UserDto`, `CreateUserRequest`, `UserResponse` — **boundary Request/Response classes are generated from the OpenAPI contract** (`api.dto`, see `api_contract_conventions.md`); `dto/` holds internal/domain DTOs only |
| Mapper | `*Mapper` | `UserMapper` |

## Example

```
feature/user/
├── controller/
│   └── UserController.java        # implements the generated UserApi
├── service/
│   ├── UserService.java
│   └── UserValidationService.java
├── repository/
│   └── UserRepository.java
├── entity/
│   └── UserEntity.java
├── dto/
│   └── UserSummaryDto.java        # internal only — CreateUserRequest/UserResponse come generated from api.dto
└── mapper/
    └── UserMapper.java
```
