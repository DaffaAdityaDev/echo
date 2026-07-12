================================================================================
  ARCHITECTURE — DOCUMENTATION INDEX
================================================================================
  Module    : Architecture
  Service   : Shared / Architecture
  Version   : 1.0
  Updated   : 2026-07-09
================================================================================

## Overview

System architecture decisions and patterns that define Echo's cross-service
design philosophy.

## Document Index

+--------------------+---------------------------------------------------+-------------------------+
| File               | Description                                       | Status                  |
+--------------------+---------------------------------------------------+-------------------------+
| headless-haas.md   | Headless Harness as a Service — agent compute      | Completed               |
|                    |   isolation, tool-binding, prefix caching          |                         |
| zero-tight-        | Zero Tight Coupling — interface-first design       | Completed               |
| coupling.md        |   across all layers                               |                         |
+--------------------+---------------------------------------------------+-------------------------+

## Quick Reference

+--------------------------------------+---------------------------------------------+
| Topic                                | Document                                    |
+--------------------------------------+---------------------------------------------+
| Agent compute isolation              | headless-haas.md                            |
| Bridge contract (Go <-> Hono)        | headless-haas.md / zero-tight-coupling.md  |
| Interface-first design               | zero-tight-coupling.md                      |
| Adapter-agnostic connections         | zero-tight-coupling.md                      |
| Provider-agnostic LLM                | zero-tight-coupling.md                      |
| Frontend repository pattern          | zero-tight-coupling.md                      |
+--------------------------------------+---------------------------------------------+

================================================================================
  (c) 2026 Echo — All Rights Reserved
================================================================================
