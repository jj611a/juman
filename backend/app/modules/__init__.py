"""
Future bounded-context modules live under this package.

Each module (users, inventory, customers, ...) owns its models, schemas,
repositories, services, and API routers. The foundation must never import
concrete modules from here.
"""
