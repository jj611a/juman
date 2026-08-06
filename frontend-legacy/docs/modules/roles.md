# Roles module (5.11)

Arabic RTL feature under `src/features/roles/`.

## Transport

- `apiClient.roles.*` + `apiClient.permissions.list`
- Matrix: `POST .../permissions` additive; `DELETE .../permissions/{id}` remove one
- Role PUT is metadata only

## Locks

- Do not send full matrix on role PUT
- System roles cannot be deleted
