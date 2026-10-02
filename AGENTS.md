# Project Architecture Rules

- ERP financial records are mirrored and authorized by normalized customer code; they do not depend on locally-created orders.
- Store financial display cutoffs live in store settings and filter reads without deleting synchronized history.