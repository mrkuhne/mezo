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
        .library(name: "BoopShared", targets: ["BoopShared"]),
    ],
    dependencies: [
        .package(url: "https://github.com/apple/swift-openapi-generator", from: "1.6.0"),
        .package(url: "https://github.com/apple/swift-openapi-runtime", from: "1.7.0"),
        .package(url: "https://github.com/apple/swift-openapi-urlsession", from: "1.0.2"),
        .package(url: "https://github.com/apple/swift-http-types", from: "1.0.0"),
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
                "BoopShared",
                .product(name: "OpenAPIRuntime", package: "swift-openapi-runtime"),
                .product(name: "OpenAPIURLSession", package: "swift-openapi-urlsession"),
                .product(name: "HTTPTypes", package: "swift-http-types"),
            ]
        ),
        .target(name: "BoopDesign", resources: [.process("Resources")]),
        // What the app and the widget extension both read (mezo-r36n9.172): no dependencies, so the extension stays small.
        .target(name: "BoopShared"),
        .testTarget(name: "BoopCoreTests", dependencies: ["BoopCore", "BoopAPI", .product(name: "HTTPTypes", package: "swift-http-types")]),
        .testTarget(name: "BoopDesignTests", dependencies: ["BoopDesign"]),
        .testTarget(name: "BoopSharedTests", dependencies: ["BoopShared"]),
    ]
)
