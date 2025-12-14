<?php

namespace App\Models;

/**
 * BaseModel - Abstract base class for all models
 * 
 * Provides common functionality for model operations including:
 * - Attribute management
 * - Type casting
 * - Relationship helpers
 * - Validation support
 */
abstract class BaseModel
{
    /**
     * The table associated with the model.
     */
    protected string $table = '';

    /**
     * The model's attributes.
     */
    protected array $attributes = [];

    /**
     * The attributes that are mass assignable.
     */
    protected array $fillable = [];

    /**
     * The attributes that should be cast.
     */
    protected array $casts = [];

    /**
     * Default attribute values.
     */
    protected array $defaults = [];

    /**
     * Create a new model instance.
     * 
     * @param array $attributes Initial attributes
     */
    public function __construct(array $attributes = [])
    {
        $this->attributes = array_merge($this->defaults, $attributes);
    }

    /**
     * Get the table name.
     * 
     * @return string
     */
    public function getTable(): string
    {
        return $this->table;
    }

    /**
     * Fill the model with an array of attributes.
     * 
     * @param array $attributes
     * @return self
     */
    public function fill(array $attributes): self
    {
        foreach ($attributes as $key => $value) {
            if (in_array($key, $this->fillable) || empty($this->fillable)) {
                $this->setAttribute($key, $value);
            }
        }
        return $this;
    }

    /**
     * Set an attribute on the model.
     * 
     * @param string $key
     * @param mixed $value
     * @return self
     */
    public function setAttribute(string $key, $value): self
    {
        $this->attributes[$key] = $this->castAttribute($key, $value, 'set');
        return $this;
    }

    /**
     * Get an attribute from the model.
     * 
     * @param string $key
     * @param mixed $default
     * @return mixed
     */
    public function getAttribute(string $key, $default = null)
    {
        $value = $this->attributes[$key] ?? $default;
        return $this->castAttribute($key, $value, 'get');
    }

    /**
     * Cast an attribute to its proper type.
     * 
     * @param string $key
     * @param mixed $value
     * @param string $direction 'get' or 'set'
     * @return mixed
     */
    protected function castAttribute(string $key, $value, string $direction = 'get')
    {
        if (!isset($this->casts[$key]) || $value === null) {
            return $value;
        }

        $castType = $this->casts[$key];

        if ($direction === 'get') {
            return $this->castForGet($value, $castType);
        }

        return $this->castForSet($value, $castType);
    }

    /**
     * Cast value when getting from model.
     * 
     * @param mixed $value
     * @param string $castType
     * @return mixed
     */
    protected function castForGet($value, string $castType)
    {
        switch ($castType) {
            case 'array':
            case 'json':
                if (is_string($value)) {
                    return json_decode($value, true) ?? [];
                }
                return is_array($value) ? $value : [];

            case 'bool':
            case 'boolean':
                return (bool) $value;

            case 'int':
            case 'integer':
                return (int) $value;

            case 'float':
            case 'double':
                return (float) $value;

            case 'string':
                return (string) $value;

            case 'datetime':
                if ($value instanceof \DateTimeInterface) {
                    return $value;
                }
                if (is_string($value)) {
                    return new \DateTimeImmutable($value);
                }
                return $value;

            default:
                return $value;
        }
    }

    /**
     * Cast value when setting on model.
     * 
     * @param mixed $value
     * @param string $castType
     * @return mixed
     */
    protected function castForSet($value, string $castType)
    {
        switch ($castType) {
            case 'array':
            case 'json':
                if (is_array($value)) {
                    return json_encode($value);
                }
                return $value;

            case 'datetime':
                if ($value instanceof \DateTimeInterface) {
                    return $value->format('Y-m-d H:i:s');
                }
                return $value;

            default:
                return $value;
        }
    }

    /**
     * Get all attributes.
     * 
     * @return array
     */
    public function getAttributes(): array
    {
        return $this->attributes;
    }

    /**
     * Convert model to array with casted values.
     * 
     * @return array
     */
    public function toArray(): array
    {
        $result = [];
        foreach ($this->attributes as $key => $value) {
            $result[$key] = $this->getAttribute($key);
        }
        return $result;
    }

    /**
     * Convert model to JSON.
     * 
     * @return string
     */
    public function toJson(): string
    {
        return json_encode($this->toArray());
    }

    /**
     * Helper for belongsTo relationship.
     * Returns placeholder - actual implementation depends on database layer.
     * 
     * @param string $table Related table name
     * @param string $foreignKey Foreign key on this model
     * @param string $ownerKey Primary key on related table
     * @return array|null
     */
    protected function belongsTo(string $table, string $foreignKey, string $ownerKey = 'id'): ?array
    {
        // This is a placeholder that returns relationship metadata
        // Actual database queries should be handled by a repository/service layer
        return [
            '_relationship' => 'belongsTo',
            '_table' => $table,
            '_foreign_key' => $foreignKey,
            '_owner_key' => $ownerKey,
            '_value' => $this->attributes[$foreignKey] ?? null,
        ];
    }

    /**
     * Helper for hasMany relationship.
     * Returns placeholder - actual implementation depends on database layer.
     * 
     * @param string $table Related table name
     * @param string $foreignKey Foreign key on related table
     * @param string $localKey Local key on this model
     * @return array
     */
    protected function hasMany(string $table, string $foreignKey, string $localKey = 'id'): array
    {
        // This is a placeholder that returns relationship metadata
        // Actual database queries should be handled by a repository/service layer
        return [
            '_relationship' => 'hasMany',
            '_table' => $table,
            '_foreign_key' => $foreignKey,
            '_local_key' => $localKey,
            '_value' => $this->attributes[$localKey] ?? null,
        ];
    }

    /**
     * Magic getter for attributes.
     * 
     * @param string $name
     * @return mixed
     */
    public function __get(string $name)
    {
        return $this->getAttribute($name);
    }

    /**
     * Magic setter for attributes.
     * 
     * @param string $name
     * @param mixed $value
     */
    public function __set(string $name, $value): void
    {
        $this->setAttribute($name, $value);
    }

    /**
     * Check if attribute exists.
     * 
     * @param string $name
     * @return bool
     */
    public function __isset(string $name): bool
    {
        return isset($this->attributes[$name]);
    }
}
