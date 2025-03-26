export function sanitizeSqlQuery(query: string): string {
    // Remove SQL code block markers
    let sanitized = query.replace(/```sql|```/g, '');
    
    // Remove leading/trailing whitespace
    sanitized = sanitized.trim();
    
    // Replace newline characters with spaces
    sanitized = sanitized.replace(/\n/g, ' ');
    
    // Replace multiple spaces with a single space
    sanitized = sanitized.replace(/\s+/g, ' ');
    
    return sanitized;
  }