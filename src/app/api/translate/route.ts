import { NextRequest, NextResponse } from "next/server";

const OPENAI_API_URL = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = "gpt-5-mini";
const MAX_ITEMS = 100;
const MAX_TOTAL_CHARACTERS = 20_000;

type TranslateRequestBody = {
  texts?: unknown;
};

type OpenAIOutputContent =
  | {
      type: "output_text";
      text: string;
    }
  | {
      type: "refusal";
      refusal: string;
    }
  | {
      type: string;
      [key: string]: unknown;
    };

type OpenAIOutputItem = {
  type?: string;
  content?: OpenAIOutputContent[];
};

type OpenAIResponse = {
  output?: OpenAIOutputItem[];
  error?: {
    message?: string;
  };
};

type TranslationResult = {
  translations: string[];
};

function validateTexts(value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw new Error('Поле "texts" должно быть массивом строк.');
  }

  if (value.length === 0) {
    throw new Error("Нет текста для перевода.");
  }

  if (value.length > MAX_ITEMS) {
    throw new Error(
      `Можно перевести не более ${MAX_ITEMS} строк за один запрос.`
    );
  }

  const texts = value.map((item) => {
    if (typeof item !== "string") {
      throw new Error('Каждый элемент "texts" должен быть строкой.');
    }

    return item.trim();
  });

  const totalCharacters = texts.reduce((sum, text) => sum + text.length, 0);

  if (totalCharacters > MAX_TOTAL_CHARACTERS) {
    throw new Error(
      `Общий объём текста не должен превышать ${MAX_TOTAL_CHARACTERS} символов.`
    );
  }

  return texts;
}

function extractOutputText(data: OpenAIResponse): string | null {
  if (!Array.isArray(data.output)) return null;

  for (const item of data.output) {
    if (!Array.isArray(item.content)) continue;

    for (const content of item.content) {
      if (content.type === "output_text" && typeof content.text === "string") {
        return content.text;
      }

      if (content.type === "refusal" && typeof content.refusal === "string") {
        throw new Error(`OpenAI отказался выполнить перевод: ${content.refusal}`);
      }
    }
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY не найден в .env.local." },
        { status: 500 }
      );
    }

    const body = (await request.json()) as TranslateRequestBody;
    const texts = validateTexts(body.texts);

    const response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_TRANSLATION_MODEL || DEFAULT_MODEL,
        instructions:
          "Ты профессиональный переводчик документации французского автосервиса. " +
          "Переводи русский текст на естественный профессиональный французский язык, " +
          "который используют гаражи и автомастерские во Франции. " +
          "Не добавляй новых работ, деталей, диагнозов или обещаний. " +
          "Не изменяй VIN, регистрационные номера, артикулы, бренды, числа, валюты, " +
          "количество, единицы измерения и технические коды. " +
          "Сохраняй порядок строк. Пустые строки возвращай пустыми. " +
          "Формулировки делай краткими и подходящими для devis или facture.",
        input: JSON.stringify({ texts }),
        text: {
          format: {
            type: "json_schema",
            name: "garage_translations",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                translations: {
                  type: "array",
                  items: {
                    type: "string",
                  },
                },
              },
              required: ["translations"],
            },
          },
        },
      }),
      cache: "no-store",
    });

    const data = (await response.json()) as OpenAIResponse;

    if (!response.ok) {
      return NextResponse.json(
        {
          error:
            data.error?.message ||
            `OpenAI API вернул ошибку ${response.status}.`,
        },
        { status: response.status }
      );
    }

    const outputText = extractOutputText(data);

    if (!outputText) {
      return NextResponse.json(
        { error: "OpenAI не вернул текст перевода." },
        { status: 502 }
      );
    }

    let result: TranslationResult;

    try {
      result = JSON.parse(outputText) as TranslationResult;
    } catch {
      return NextResponse.json(
        {
          error: "Не удалось разобрать структурированный ответ OpenAI.",
        },
        { status: 502 }
      );
    }

    if (
      !Array.isArray(result.translations) ||
      result.translations.length !== texts.length
    ) {
      return NextResponse.json(
        {
          error:
            "Количество переведённых строк не совпадает с количеством исходных.",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      translations: result.translations,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Неизвестная ошибка перевода.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}