# Java Package Structure

## Base Pattern

```
io.mrkuhne.{project}/
├── feature/
│   └── {featureName}/
│       ├── controller/   → *Controller
│       ├── service/      → *Service
│       ├── repository/   → *Repository
│       ├── entity/       → *Entity
│       ├── dto/          → *Dto, *Request, *Response
│       └── mapper/       → *Mapper (MapStruct)
└── techcore/
    ├── config/
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
| DTO | `*Dto`, `*Request`, `*Response` | `UserDto`, `CreateUserRequest`, `UserResponse` |
| Mapper | `*Mapper` | `UserMapper` |

## Example

```
feature/user/
├── controller/
│   └── UserController.java
├── service/
│   ├── UserService.java
│   └── UserValidationService.java
├── repository/
│   └── UserRepository.java
├── entity/
│   └── UserEntity.java
├── dto/
│   ├── UserDto.java
│   ├── CreateUserRequest.java
│   └── UserResponse.java
└── mapper/
    └── UserMapper.java
```
