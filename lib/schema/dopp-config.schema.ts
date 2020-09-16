export const Schema = {
  "type": "object",
  "properties": {
    "defaultNetwork": {
      "type": "string"
    },
    "dockerEndpoint": {
      "type": "string"
    },
    "services": {
      "type": "array",
      "items": {
        "type": "string"
      }
    }
  },
  "$schema": "http://json-schema.org/draft-07/schema#"
}