export const Schema = {
  "type": "object",
  "properties": {
    "name": {
      "type": "string"
    },
    "image": {
      "type": "string"
    },
    "env": {
      "type": "array",
      "items": {
        "anyOf": [
          {
            "$ref": "#/definitions/AppEnvFile"
          },
          {
            "$ref": "#/definitions/AppEnvPair"
          },
          {
            "$ref": "#/definitions/AppEnvPrivate"
          },
          {
            "type": "string"
          }
        ]
      }
    },
    "volumes": {
      "type": "array",
      "items": {
        "anyOf": [
          {
            "$ref": "#/definitions/AppVolume"
          },
          {
            "type": "string"
          }
        ]
      }
    },
    "networks": {
      "type": "array",
      "items": {
        "anyOf": [
          {
            "$ref": "#/definitions/AppNetwork"
          },
          {
            "type": "string"
          }
        ]
      }
    },
    "labels": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "extends": {
      "anyOf": [
        {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        {
          "type": "string"
        }
      ]
    },
    "services": {
      "type": "array",
      "items": {
        "$ref": "#/definitions/AppService"
      }
    },
    "ports": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "command": {
      "anyOf": [
        {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        {
          "type": "string"
        }
      ]
    },
    "entrypoint": {
      "anyOf": [
        {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        {
          "type": "string"
        }
      ]
    }
  },
  "definitions": {
    "AppEnvFile": {
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "file"
          ]
        },
        "file": {
          "type": "string"
        }
      }
    },
    "AppEnvPair": {
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "pair"
          ]
        },
        "key": {
          "type": "string"
        },
        "value": {
          "type": "string"
        }
      }
    },
    "AppEnvPrivate": {
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "private"
          ]
        },
        "name": {
          "type": "string"
        }
      }
    },
    "AppVolume": {
      "type": "object",
      "properties": {
        "source": {
          "type": "string"
        },
        "target": {
          "type": "string"
        },
        "type": {
          "type": "string"
        }
      }
    },
    "AppNetwork": {
      "type": "object",
      "properties": {
        "type": {
          "type": "string"
        },
        "name": {
          "type": "string"
        },
        "aliases": {
          "type": "array",
          "items": {
            "type": "string"
          }
        }
      }
    },
    "AppService": {
      "type": "object",
      "additionalProperties": {},
      "properties": {
        "use": {
          "type": "string"
        }
      }
    }
  },
  "$schema": "http://json-schema.org/draft-07/schema#"
}