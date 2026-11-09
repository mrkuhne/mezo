// swift-tools-version: 6.2
import PackageDescription

let package = Package(
    name: "BoopKit",
    defaultLocalization: "hu",
    platforms: [.iOS(.v26), .macOS(.v15)],
    products: [
        .library(name: "BoopAPI", targets: ["BoopAPI"]),
        .library(name: "BoopCore", targets: ["BoopCore"]),
        .library(name: "BoopDesign", targets: ["BoopDesign"]),
    ],
    dependencies: [
        .package(url: "https://github.com/apple/swift-openapi-generator", from: "1.6.0"),
        .package(url: "https://github.com/apple/swift-openapi-runtime", from: "1.7.0"),
        .package(url: "https://github.com/apple/swift-openapi-urlsession", from: "1.0.2"),
    ],
    targets: [
        .target(
            name: "BoopAPI",
            dependencies: [.product(name: "OpenAPIRuntime", package: "swift-openapi-runtime")],
            plugins: [.plugin(name: "OpenAPIGenerator", package: "swift-openapi-generator")]
        ),
        .target(
            name: "BoopCore",
            dependencies: [
                "BoopAPI",
                .product(name: "OpenAPIRuntime", package: "swift-openapi-runtime"),
                .product(name: "OpenAPIURLSession", package: "swift-openapi-urlsession"),
            ]
        ),
        .target(name: "BoopDesign"),
        .testTarget(name: "BoopCoreTests", dependencies: ["BoopCore", "BoopAPI"]),
        .testTarget(name: "BoopDesignTests", dependencies: ["BoopDesign"]),
    ]
)
