import { NextResponse } from "next/server";
import OpenAI from "openai";

export async function GET() {
  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // List all models
    const models = await openai.models.list();

    // Filter for realtime models only
    const realtimeModels = models.data
      .filter(model =>
        model.id.includes('realtime') ||
        model.id.includes('gpt-4o-realtime')
      )
      .map(model => ({
        id: model.id,
        created: model.created,
        owned_by: model.owned_by,
      }))
      .sort((a, b) => b.created - a.created); // Sort by newest first

    // If no realtime models found, return known models
    if (realtimeModels.length === 0) {
      return NextResponse.json({
        models: [
          {
            id: 'gpt-4o-realtime-preview-2025-06-03',
            created: 0,
            owned_by: 'openai',
            description: 'Latest GPT-4o Realtime model',
          },
          {
            id: 'gpt-realtime',
            created: 0,
            owned_by: 'openai',
            description: 'Realtime model alias',
          },
        ],
        note: 'Using known realtime models (API did not return realtime models)',
      });
    }

    return NextResponse.json({
      models: realtimeModels,
    });
  } catch (error) {
    console.error('Error fetching models:', error);

    // Return known models as fallback
    return NextResponse.json({
      models: [
        {
          id: 'gpt-4o-realtime-preview-2025-06-03',
          created: 0,
          owned_by: 'openai',
          description: 'Latest GPT-4o Realtime model',
        },
        {
          id: 'gpt-realtime',
          created: 0,
          owned_by: 'openai',
          description: 'Realtime model alias',
        },
      ],
      error: error instanceof Error ? error.message : 'Failed to fetch models',
    });
  }
}
