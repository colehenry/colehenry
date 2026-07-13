"""Portable column types.

Production runs on Postgres, where these render as JSONB/ARRAY exactly as
before. The SQLite variant (plain JSON) exists so tests can build the schema
with Base.metadata.create_all against a throwaway SQLite database.
"""

from sqlalchemy import JSON, Integer, String
from sqlalchemy.dialects.postgresql import ARRAY, JSONB

PortableJSONB = JSONB().with_variant(JSON(), "sqlite")
PortableStringArray = ARRAY(String).with_variant(JSON(), "sqlite")
PortableIntArray = ARRAY(Integer).with_variant(JSON(), "sqlite")
