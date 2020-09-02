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
        "anyOf": [
          {
            "type": "array",
            "items": [
              {
                "type": "string"
              },
              {}
            ],
            "minItems": 1,
            "additionalItems": {
              "anyOf": [
                {
                  "type": "string"
                },
                {}
              ]
            }
          },
          {
            "type": "string"
          }
        ]
      }
    }
  },
  "$schema": "http://json-schema.org/draft-07/schema#"
}