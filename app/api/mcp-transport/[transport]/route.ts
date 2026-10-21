import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { 
  getIntrospectionQuery, 
  buildClientSchema, 
  GraphQLSchema,
  isNonNullType,
  isListType,
  isInputObjectType,
} from 'graphql';
import { resolveServerBaseUrl } from '@/features/keystone/lib/server-base-url';
import {
  assertGraphQLOperation,
  assertGraphQLSelection,
  boundedSearchLimit,
  graphqlStringLiteral,
} from '../graphql-input';

// Get simple type name for display
function getSimpleTypeName(type: any): string {
  if (isNonNullType(type)) {
    return getSimpleTypeName(type.ofType);
  }
  if (isListType(type)) {
    return `[${getSimpleTypeName(type.ofType)}]`;
  }
  return type.name || type.toString();
}

// Execute GraphQL query with authentication
async function executeGraphQL(query: string, graphqlEndpoint: string, cookie: string): Promise<any> {
  const response = await fetch(graphqlEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookie,
    },
    body: JSON.stringify({ query }),
  });

  const result = await response.json();
  if (result.errors) {
    throw new Error(`GraphQL execution failed: ${JSON.stringify(result.errors)}`);
  }
  return result;
}

// Get GraphQL schema from introspection
async function getGraphQLSchema(graphqlEndpoint: string, cookie: string): Promise<GraphQLSchema> {
  const response = await fetch(graphqlEndpoint, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Cookie': cookie,
    },
    body: JSON.stringify({ query: getIntrospectionQuery() }),
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  const result = await response.json();
  if (result.errors) {
    throw new Error(`GraphQL introspection failed: ${JSON.stringify(result.errors)}`);
  }
  
  return buildClientSchema(result.data);
}

export async function POST(request: Request, { params }: { params: Promise<{ transport: string }> }) {
  // Track if any CRUD operations occurred during this request
  let dataHasChanged = false;
  
  try {
    if (process.env.NODE_ENV === 'production' && process.env.AI_ASSISTANT_ENABLED !== 'true') return new Response('Not found', { status: 404 })
    const { transport } = await params;
    if (transport !== 'http') {
      return new Response(JSON.stringify({
        jsonrpc: '2.0', id: null,
        error: { code: -32600, message: 'Unsupported transport' },
      }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    // Construct GraphQL endpoint
    const baseUrl = resolveServerBaseUrl();
    const graphqlEndpoint = `${baseUrl}/api/graphql`;
    
    // Extract cookie from request and fail before introspection for anonymous callers.
    const cookie = request.headers.get('cookie') || ''
    const authResult = await executeGraphQL('query { authenticatedItem { ... on User { id } } }', graphqlEndpoint, cookie)
    if (!authResult.data?.authenticatedItem?.id) return new Response(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32001, message: 'Authentication required' } }), { status: 401, headers: { 'Content-Type': 'application/json' } })

    // Get the GraphQL schema
    const schema = await getGraphQLSchema(graphqlEndpoint, cookie);
    
    // Parse the JSON-RPC request
    const body = await request.json();
    
    // Handle the request based on method
    if (body.method === 'initialize') {
      return new Response(JSON.stringify({
        jsonrpc: '2.0',
        id: body.id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: { listChanged: true },
          },
          serverInfo: {
            name: 'simple-mcp-server',
            version: '1.0.0'
          }
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } else if (body.method === 'notifications/initialized') {
      return new Response(JSON.stringify({
        jsonrpc: '2.0',
        id: body.id,
        result: {}
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } else if (body.method === 'tools/list') {
      // Return tools
      const tools: Tool[] = [{
        name: 'listModels',
        description: 'List all available GraphQL models/types in the system',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      }, {
        name: 'queryData',
        description: 'Execute a GraphQL query to get actual data from the system',
        inputSchema: {
          type: 'object',
          properties: {
            operation: {
              type: 'string',
              description: 'The GraphQL operation name (e.g., "users", "bookings", "passengers")'
            },
            fields: {
              type: 'string',
              description: 'The fields to select (e.g., "id name email" or "id title description")'
            }
          },
          required: ['operation', 'fields']
        }
      }, {
        name: 'searchModels',
        description: 'Search for models by name pattern',
        inputSchema: {
          type: 'object',
          properties: {
            searchTerm: {
              type: 'string',
              description: 'The search term to find models (e.g., "User", "Booking", "Passenger")'
            }
          },
          required: ['searchTerm']
        }
      }, {
        name: 'getFieldsForType',
        description: 'Get all available fields for a specific GraphQL type',
        inputSchema: {
          type: 'object',
          properties: {
            typeName: {
              type: 'string',
              description: 'The GraphQL type name to get fields for (e.g., "User", "Booking", "Passenger")'
            }
          },
          required: ['typeName']
        }
      }, {
        name: 'lookupInputType',
        description: 'Get the structure of a GraphQL input type for mutations',
        inputSchema: {
          type: 'object',
          properties: {
            inputTypeName: {
              type: 'string',
              description: 'The GraphQL input type name (e.g., "PassengerCreateInput", "BookingUpdateInput")'
            }
          },
          required: ['inputTypeName']
        }
      }, {
        name: 'createData',
        description: 'Execute a GraphQL mutation to create new data',
        inputSchema: {
          type: 'object',
          properties: {
            operation: {
              type: 'string',
              description: 'The GraphQL create mutation name (e.g., "createPassenger", "createBooking")'
            },
            data: {
              type: 'string',
              description: 'JSON string of the data object to create'
            },
            fields: {
              type: 'string',
              description: 'The fields to return from the created item'
            }
          },
          required: ['operation', 'data', 'fields']
        }
      }, {
        name: 'updateData',
        description: 'Execute a GraphQL mutation to update existing data',
        inputSchema: {
          type: 'object',
          properties: {
            operation: {
              type: 'string',
              description: 'The GraphQL update mutation name (e.g., "updatePassenger", "updateBooking")'
            },
            where: {
              type: 'string',
              description: 'JSON string of the where clause to identify the item to update'
            },
            data: {
              type: 'string',
              description: 'JSON string of the data object with fields to update'
            },
            fields: {
              type: 'string',
              description: 'The fields to return from the updated item'
            }
          },
          required: ['operation', 'where', 'data', 'fields']
        }
      }, {
        name: 'deleteData',
        description: 'Execute a GraphQL mutation to delete data',
        inputSchema: {
          type: 'object',
          properties: {
            operation: {
              type: 'string',
              description: 'The GraphQL delete mutation name (e.g., "deletePassenger", "deleteBooking")'
            },
            where: {
              type: 'string',
              description: 'JSON string of the where clause to identify the item to delete'
            },
            fields: {
              type: 'string',
              description: 'The fields to return from the deleted item'
            }
          },
          required: ['operation', 'where', 'fields']
        }
      }, {
        name: 'modelSpecificSearch',
        description: 'Perform intelligent search on a specific model using the same logic as the dashboard search functionality',
        inputSchema: {
          type: 'object',
          properties: {
            modelName: {
              type: 'string',
              description: 'The model name to search (e.g., "Booking", "User", "Passenger"). Will be automatically converted to the correct GraphQL operation name.'
            },
            searchQuery: {
              type: 'string',
              description: 'The search term to find within the model. Supports both ID matching and text field searching with case-insensitive matching.'
            },
            fields: {
              type: 'string',
              description: 'The fields to return from matching items (e.g., "id name email" or "id title description")'
            }
          },
          required: ['modelName', 'searchQuery', 'fields']
        }
      }];
      
      return new Response(JSON.stringify({
        jsonrpc: '2.0',
        id: body.id,
        result: { tools }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } else if (body.method === 'tools/call') {
      // Handle tool call
      const { name, arguments: args } = body.params;

      try {
        if (name === 'listModels') {
          const allModels: any[] = [];
          
          // Get all types from schema
          const typeMap = schema.getTypeMap();
          
          for (const [typeName, type] of Object.entries(typeMap)) {
            // Skip built-in GraphQL types
            if (typeName.startsWith('__')) continue;
            
            // Find related operations for this type
            const relatedOps: string[] = [];
            
            // Check queries
            if (schema.getQueryType()) {
              const queryFields = schema.getQueryType()!.getFields();
              for (const [queryName] of Object.entries(queryFields)) {
                const baseTypeName = typeName.toLowerCase().replace(/input$|type$/i, '');
                if (queryName.toLowerCase().includes(baseTypeName) || 
                    queryName.toLowerCase() === baseTypeName + 's' ||
                    queryName.toLowerCase() === baseTypeName) {
                  relatedOps.push(`Query: ${queryName}`);
                }
              }
            }
            
            // Check mutations  
            if (schema.getMutationType()) {
              const mutationFields = schema.getMutationType()!.getFields();
              for (const [mutationName] of Object.entries(mutationFields)) {
                const baseTypeName = typeName.toLowerCase().replace(/input$|type$/i, '');
                if (mutationName.toLowerCase().includes(baseTypeName)) {
                  relatedOps.push(`Mutation: ${mutationName}`);
                }
              }
            }
            
            allModels.push({
              typeName,
              description: type.description || `GraphQL type: ${typeName}`,
              kind: type.constructor.name,
              relatedOperations: relatedOps
            });
          }
          
          // Sort by name
          allModels.sort((a, b) => a.typeName.localeCompare(b.typeName));
          
          const result = {
            totalModels: allModels.length,
            models: allModels
          };
          
          return new Response(JSON.stringify({
            jsonrpc: '2.0',
            id: body.id,
            result: {
              content: [{
                type: 'text',
                text: JSON.stringify(result, null, 2),
              }],
            }
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        
        if (name === 'queryData') {
          const { operation, fields } = args;
          const safeOperation = assertGraphQLOperation(schema, operation, 'query');
          const safeFields = assertGraphQLSelection(fields);

          // Build a simple GraphQL query
          const queryString = `
            query ${safeOperation.charAt(0).toUpperCase() + safeOperation.slice(1)} {
              ${safeOperation} {
                ${safeFields}
              }
            }
          `.trim();
          
          // Execute the query
          const result = await executeGraphQL(queryString, graphqlEndpoint, cookie || '');
          
          return new Response(JSON.stringify({
            jsonrpc: '2.0',
            id: body.id,
            result: {
              content: [{
                type: 'text',
                text: JSON.stringify(result, null, 2),
              }],
            }
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        
        if (name === 'searchModels') {
          const { searchTerm } = args;
          const searchLower = searchTerm.toLowerCase();
          
          const matchingModels: any[] = [];
          
          // Get all types from schema
          const typeMap = schema.getTypeMap();
          
          for (const [typeName, type] of Object.entries(typeMap)) {
            // Skip built-in GraphQL types
            if (typeName.startsWith('__')) continue;
            
            // Check if type name matches search term
            if (typeName.toLowerCase().includes(searchLower)) {
              // Find related operations for this type
              const relatedOps: string[] = [];
              
              // Check queries
              if (schema.getQueryType()) {
                const queryFields = schema.getQueryType()!.getFields();
                for (const [queryName] of Object.entries(queryFields)) {
                  const baseTypeName = typeName.toLowerCase().replace(/input$|type$/i, '');
                  if (queryName.toLowerCase().includes(baseTypeName) || 
                      queryName.toLowerCase() === baseTypeName + 's' ||
                      queryName.toLowerCase() === baseTypeName) {
                    relatedOps.push(`Query: ${queryName}`);
                  }
                }
              }
              
              // Check mutations  
              if (schema.getMutationType()) {
                const mutationFields = schema.getMutationType()!.getFields();
                for (const [mutationName] of Object.entries(mutationFields)) {
                  const baseTypeName = typeName.toLowerCase().replace(/input$|type$/i, '');
                  if (mutationName.toLowerCase().includes(baseTypeName)) {
                    relatedOps.push(`Mutation: ${mutationName}`);
                  }
                }
              }
              
              matchingModels.push({
                typeName,
                description: type.description || `GraphQL type: ${typeName}`,
                kind: type.constructor.name,
                relatedOperations: relatedOps
              });
            }
          }
          
          // Sort by name
          matchingModels.sort((a, b) => a.typeName.localeCompare(b.typeName));
          
          const result = {
            searchTerm,
            matchingModels: matchingModels.length,
            models: matchingModels
          };
          
          return new Response(JSON.stringify({
            jsonrpc: '2.0',
            id: body.id,
            result: {
              content: [{
                type: 'text',
                text: JSON.stringify(result, null, 2),
              }],
            }
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        
        if (name === 'getFieldsForType') {
          const { typeName } = args;
          
          // Get the specific type from schema
          const typeMap = schema.getTypeMap();
          const type = typeMap[typeName];
          
          if (!type) {
            return new Response(JSON.stringify({
              jsonrpc: '2.0',
              id: body.id,
              result: {
                content: [{
                  type: 'text',
                  text: JSON.stringify({
                    error: `Type '${typeName}' not found in schema`,
                    availableTypes: Object.keys(typeMap).filter(name => !name.startsWith('__'))
                  }, null, 2),
                }],
              }
            }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            });
          }
          
          const fields: any[] = [];
          
          // Check if type has fields (ObjectType or InputObjectType)
          if ('getFields' in type && typeof type.getFields === 'function') {
            const typeFields = type.getFields();
            
            for (const [fieldName, field] of Object.entries(typeFields)) {
              const fieldInfo: any = {
                name: fieldName,
                type: getSimpleTypeName(field.type),
                description: field.description || null
              };
              
              // Add args if it's a field with arguments
              if ('args' in field && field.args && field.args.length > 0) {
                fieldInfo.args = field.args.map((arg: any) => ({
                  name: arg.name,
                  type: getSimpleTypeName(arg.type),
                  description: arg.description || null,
                  defaultValue: arg.defaultValue
                }));
              }
              
              fields.push(fieldInfo);
            }
          }
          
          const result = {
            typeName,
            typeKind: type.constructor.name,
            description: type.description || null,
            fields: fields
          };
          
          return new Response(JSON.stringify({
            jsonrpc: '2.0',
            id: body.id,
            result: {
              content: [{
                type: 'text',
                text: JSON.stringify(result, null, 2),
              }],
            }
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        
        if (name === 'lookupInputType') {
          const { inputTypeName } = args;
          
          // Get the specific input type from schema
          const typeMap = schema.getTypeMap();
          const inputType = typeMap[inputTypeName];
          
          if (!inputType) {
            return new Response(JSON.stringify({
              jsonrpc: '2.0',
              id: body.id,
              result: {
                content: [{
                  type: 'text',
                  text: JSON.stringify({
                    error: `Input type '${inputTypeName}' not found in schema`,
                    availableInputTypes: Object.keys(typeMap).filter(name => 
                      !name.startsWith('__') && name.toLowerCase().includes('input')
                    )
                  }, null, 2),
                }],
              }
            }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            });
          }
          
          const inputFields: any[] = [];
          
          // Check if it's an input object type
          if (isInputObjectType(inputType)) {
            const fields = inputType.getFields();
            
            for (const [fieldName, field] of Object.entries(fields)) {
              const inputField = field as any;
              const inputFieldInfo: any = {
                name: fieldName,
                type: getSimpleTypeName(inputField.type),
                description: inputField.description || null,
                required: isNonNullType(inputField.type),
                defaultValue: inputField.defaultValue
              };
              
              inputFields.push(inputFieldInfo);
            }
          }
          
          const result = {
            inputTypeName,
            typeKind: inputType.constructor.name,
            description: inputType.description || null,
            fields: inputFields,
            isInputType: isInputObjectType(inputType)
          };
          
          return new Response(JSON.stringify({
            jsonrpc: '2.0',
            id: body.id,
            result: {
              content: [{
                type: 'text',
                text: JSON.stringify(result, null, 2),
              }],
            }
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        
        if (name === 'createData') {
          const { operation, data, fields } = args;
          const safeOperation = assertGraphQLOperation(schema, operation, 'mutation');
          const safeFields = assertGraphQLSelection(fields);

          // Parse the data JSON string
          const dataObject = JSON.parse(data);

          const mutationString = `
            mutation Create${safeOperation.charAt(0).toUpperCase() + safeOperation.slice(1)} {
              ${safeOperation}(data: ${JSON.stringify(dataObject).replace(/\"([^\"]+)\":/g, '$1:')}) {
                ${safeFields}
              }
            }
          `.trim();
          
          // Execute the mutation
          const result = await executeGraphQL(mutationString, graphqlEndpoint, cookie || '');
          
          // Mark that data has changed
          dataHasChanged = true;
          
          return new Response(JSON.stringify({
            jsonrpc: '2.0',
            id: body.id,
            result: {
              content: [{
                type: 'text',
                text: JSON.stringify(result, null, 2),
              }],
            }
          }), {
            status: 200,
            headers: { 
              'Content-Type': 'application/json',
              'X-Data-Changed': 'true'
            },
          });
        }
        
        if (name === 'updateData') {
          const { operation, where, data, fields } = args;
          const safeOperation = assertGraphQLOperation(schema, operation, 'mutation');
          const safeFields = assertGraphQLSelection(fields);

          // Parse the JSON strings
          const whereObject = JSON.parse(where);
          const dataObject = JSON.parse(data);

          const mutationString = `
            mutation Update${safeOperation.charAt(0).toUpperCase() + safeOperation.slice(1)} {
              ${safeOperation}(where: ${JSON.stringify(whereObject).replace(/\"([^\"]+)\":/g, '$1:')}, data: ${JSON.stringify(dataObject).replace(/\"([^\"]+)\":/g, '$1:')}) {
                ${safeFields}
              }
            }
          `.trim();
          
          // Execute the mutation
          const result = await executeGraphQL(mutationString, graphqlEndpoint, cookie || '');
          
          // Mark that data has changed
          dataHasChanged = true;
          
          return new Response(JSON.stringify({
            jsonrpc: '2.0',
            id: body.id,
            result: {
              content: [{
                type: 'text',
                text: JSON.stringify(result, null, 2),
              }],
            }
          }), {
            status: 200,
            headers: { 
              'Content-Type': 'application/json',
              'X-Data-Changed': 'true'
            },
          });
        }
        
        if (name === 'deleteData') {
          const { operation, where, fields } = args;
          const safeOperation = assertGraphQLOperation(schema, operation, 'mutation');
          const safeFields = assertGraphQLSelection(fields);

          // Parse the where JSON string
          const whereObject = JSON.parse(where);

          const mutationString = `
            mutation Delete${safeOperation.charAt(0).toUpperCase() + safeOperation.slice(1)} {
              ${safeOperation}(where: ${JSON.stringify(whereObject).replace(/\"([^\"]+)\":/g, '$1:')}) {
                ${safeFields}
              }
            }
          `.trim();
          
          // Execute the mutation
          const result = await executeGraphQL(mutationString, graphqlEndpoint, cookie || '');
          
          // Mark that data has changed
          dataHasChanged = true;
          
          return new Response(JSON.stringify({
            jsonrpc: '2.0',
            id: body.id,
            result: {
              content: [{
                type: 'text',
                text: JSON.stringify(result, null, 2),
              }],
            }
          }), {
            status: 200,
            headers: { 
              'Content-Type': 'application/json',
              'X-Data-Changed': 'true'
            },
          });
        }
        
        if (name === 'modelSpecificSearch') {
          const { modelName, searchQuery, fields, limit = 10 } = args;
          const safeFields = assertGraphQLSelection(fields);
          const safeLimit = boundedSearchLimit(limit);
          const searchLiteral = graphqlStringLiteral(searchQuery.trim());

          // Get all types from schema to find the correct model
          const typeMap = schema.getTypeMap();
          let foundModel = null;
          let operationName = null;
          
          // Find the model by name (case-insensitive)
          const modelNameLower = modelName.toLowerCase();
          for (const [typeName] of Object.entries(typeMap)) {
            if (typeName.toLowerCase() === modelNameLower || 
                typeName.toLowerCase() === modelNameLower + 's' ||
                typeName.toLowerCase().replace(/s$/, '') === modelNameLower) {
              foundModel = typeName;
              break;
            }
          }
          
          if (!foundModel) {
            return new Response(JSON.stringify({
              jsonrpc: '2.0',
              id: body.id,
              result: {
                content: [{
                  type: 'text',
                  text: JSON.stringify({
                    error: `Model '${modelName}' not found in schema`,
                    availableModels: Object.keys(typeMap).filter(name => !name.startsWith('__'))
                  }, null, 2),
                }],
              }
            }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            });
          }
          
          // Find the corresponding query operation
          if (schema.getQueryType()) {
            const queryFields = schema.getQueryType()!.getFields();
            const modelLower = foundModel.toLowerCase();
            
            // Try various naming conventions
            const possibleNames = [
              modelLower + 's',  // products
              modelLower,        // product
              foundModel.charAt(0).toLowerCase() + foundModel.slice(1) + 's', // Products -> products
              foundModel.charAt(0).toLowerCase() + foundModel.slice(1)        // Products -> product
            ];
            
            for (const name of possibleNames) {
              if (queryFields[name]) {
                operationName = name;
                break;
              }
            }
          }
          
          if (!operationName) {
            return new Response(JSON.stringify({
              jsonrpc: '2.0',
              id: body.id,
              result: {
                content: [{
                  type: 'text',
                  text: JSON.stringify({
                    error: `No query operation found for model '${modelName}'`,
                    foundModel,
                    availableOperations: schema.getQueryType() ? Object.keys(schema.getQueryType()!.getFields()) : []
                  }, null, 2),
                }],
              }
            }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            });
          }
          
          const safeOperationName = assertGraphQLOperation(schema, operationName, 'query');

          // Get the actual fields available on this model by checking the GraphQL schema
          const queryField = schema.getQueryType()?.getFields()[safeOperationName];
          const returnType = queryField?.type;
          let availableFields: string[] = [];
          
          // Extract the element type from list types and non-null wrappers
          let elementType = returnType;
          while (elementType && (isListType(elementType) || isNonNullType(elementType))) {
            elementType = elementType.ofType;
          }
          
          if (elementType && 'getFields' in elementType && typeof elementType.getFields === 'function') {
            const modelFields = elementType.getFields();
            availableFields = Object.keys(modelFields);
          }
          
          // Build search conditions using only fields that exist on the model
          const searchConditions = [];
          const searchTerm = searchQuery.trim();
          
          // Add ID search (exact match) - ID should always exist
          if (searchTerm && availableFields.includes('id')) {
            searchConditions.push(`{ id: { equals: ${searchLiteral} } }`);
          }
          
          // Add text field search (case-insensitive contains) for fields that exist
          const commonSearchFields = ['name', 'title', 'label', 'description', 'email'];
          const validSearchFields = commonSearchFields.filter(field => availableFields.includes(field));
          
          for (const fieldName of validSearchFields) {
            searchConditions.push(`{ ${fieldName}: { contains: ${searchLiteral}, mode: insensitive } }`);
          }
          
          // Build the GraphQL query manually to avoid JSON.stringify issues with enums
          let whereClause = '';
          if (searchConditions.length > 0) {
            whereClause = `where: { OR: [${searchConditions.join(', ')}] },`;
          }
          
          const queryString = `
            query Search${foundModel} {
              ${safeOperationName}(
                ${whereClause}
                take: ${safeLimit}
              ) {
                ${safeFields}
              }
            }
          `.trim();
          
          // Execute the search query
          const result = await executeGraphQL(queryString, graphqlEndpoint, cookie || '');
          
          return new Response(JSON.stringify({
            jsonrpc: '2.0',
            id: body.id,
            result: {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  searchQuery: searchTerm,
                  modelName: foundModel,
                  operationName: safeOperationName,
                  availableFields,
                  validSearchFields,
                  queryUsed: queryString,
                  results: result,
                  total: result?.data?.[safeOperationName]?.length || 0
                }, null, 2),
              }],
            }
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        
        throw new Error(`Tool ${name} not found`);
      } catch (error) {
        return new Response(JSON.stringify({
          jsonrpc: '2.0',
          id: body.id,
          result: {
            content: [{
              type: 'text',
              text: `Error executing ${name}: ${error}`,
            }],
          }
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    } else {
      return new Response(JSON.stringify({
        jsonrpc: '2.0',
        id: body.id,
        error: { code: -32601, message: 'Method not found' }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } catch (error) {
    return new Response(JSON.stringify({
      jsonrpc: '2.0',
      id: null,
      error: { 
        code: -32603, 
        message: 'Internal error',
        data: process.env.NODE_ENV === 'production'
          ? undefined
          : error instanceof Error ? error.message : String(error)
      }
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ transport: string }> }) {
  if (process.env.NODE_ENV === 'production' && process.env.AI_ASSISTANT_ENABLED !== 'true') return new Response('Not found', { status: 404 })
  const { transport } = await params;
  if (transport !== 'http') {
    return new Response(JSON.stringify({ error: 'Unsupported transport' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const baseUrl = resolveServerBaseUrl();
  const graphqlEndpoint = `${baseUrl}/api/graphql`;
  const authResult = await executeGraphQL('query { authenticatedItem { ... on User { id } } }', graphqlEndpoint, request.headers.get('cookie') || '')
  if (!authResult.data?.authenticatedItem?.id) return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401, headers: { 'Content-Type': 'application/json' } })

  return new Response(JSON.stringify({ 
    message: 'Simple MCP Server is running',
    transport: transport,
    graphqlEndpoint
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}