class RoleReadyError(Exception):
    """A safe, user-facing error. Never include provider payloads or credentials."""


class InputError(RoleReadyError):
    pass


class GenerationError(RoleReadyError):
    pass
