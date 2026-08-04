================================================================================
  ARCHITECTURE — DOCUMENTATION INDEX
================================================================================
  Module    : Architecture
  Service   : Shared / Architecture
  Version   : 1.1
  Updated   : 2026-07-31 (active: strategy lifecycle & memory GC sections)
================================================================================

## Overview

System architecture decisions and patterns that define Echo's cross-service
design philosophy.

## Document Index

+--------------------+---------------------------------------------------+-------------------------+
| File               | Description                                       | Status                  |
+--------------------+---------------------------------------------------+-------------------------+
| headless-haas.md   | Headless Harness as a Service — agent compute      | Completed               |
|                    |   isolation, tool-binding, prefix caching;         |                         |
|                    |   strategy lifecycle + memory GC sections          | Active (2026-07-31)    |
| zero-tight-        | Zero Tight Coupling — interface-first design       | Completed               |
| coupling.md        |   across all layers                               |                         |
| context-           | Context provisioning contract — backend pushes     | Completed               |
| provisioning.md    |   identity/capability/credentials per request;     |                         |
|                    |   agent pulls only what is dynamic                |                         |
+--------------------+---------------------------------------------------+-------------------------+

## Quick Reference

+--------------------------------------+---------------------------------------------+
| Topic                                | Document                                    |
+--------------------------------------+---------------------------------------------+
| Agent compute isolation              | headless-haas.md                            |
| Strategy lifecycle (control plane)   | headless-haas.md / patterns/strategy-lifecycle.md |
| Memory GC & decay                    | headless-haas.md / agent/domain/memory-and-retrieval-strategy.md |
| Bridge contract (Go <-> Hono)        | headless-haas.md / zero-tight-coupling.md  |
| Context provisioning (push/pull)     | context-provisioning.md                    |
| Interface-first design               | zero-tight-coupling.md                      |
| Adapter-agnostic connections         | zero-tight-coupling.md                      |
| Provider-agnostic LLM                | zero-tight-coupling.md                      |
| Frontend repository pattern          | zero-tight-coupling.md                      |
+--------------------------------------+---------------------------------------------+

================================================================================
  (c) 2026 Echo — All Rights Reserved
================================================================================
