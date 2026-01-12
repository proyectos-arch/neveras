'use server';

/**
 * @fileOverview Predicts potential temperature deviations based on historical data.
 *
 * - predictTemperatureDeviation - Predicts temperature deviations.
 * - PredictiveTemperatureDeviationInput - Input schema for temperature deviation prediction.
 * - PredictiveTemperatureDeviationOutput - Output schema for temperature deviation prediction.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const PredictiveTemperatureDeviationInputSchema = z.object({
  historicalTemperatureData: z
    .string()
    .describe(
      'Historical temperature data as a time-series, including timestamps and temperature readings.'
    ),
  threshold: z.number().describe('The temperature threshold for deviations.'),
  currentTemperature: z.number().describe('The current temperature reading.'),
  location: z.string().describe('Current location of the gel pack'),
});
export type PredictiveTemperatureDeviationInput = z.infer<
  typeof PredictiveTemperatureDeviationInputSchema
>;

const PredictiveTemperatureDeviationOutputSchema = z.object({
  predictedDeviation: z
    .boolean()
    .describe(
      'Whether a temperature deviation is predicted based on historical data and the specified threshold.'
    ),
  explanation: z
    .string()
    .describe(
      'An explanation of why a temperature deviation is predicted, based on the historical data and current conditions.'
    ),
  suggestedActions: z
    .string()
    .describe(
      'Suggested actions to prevent the predicted temperature deviation.'
    ),
});
export type PredictiveTemperatureDeviationOutput = z.infer<
  typeof PredictiveTemperatureDeviationOutputSchema
>;

export async function predictTemperatureDeviation(
  input: PredictiveTemperatureDeviationInput
): Promise<PredictiveTemperatureDeviationOutput> {
  return predictiveTemperatureDeviationFlow(input);
}

const prompt = ai.definePrompt({
  name: 'predictTemperatureDeviationPrompt',
  input: {schema: PredictiveTemperatureDeviationInputSchema},
  output: {schema: PredictiveTemperatureDeviationOutputSchema},
  prompt: `You are an expert in cold chain logistics, specializing in predicting temperature deviations for temperature-sensitive medical supplies.

Analyze the historical temperature data to predict if the temperature will deviate beyond the specified threshold. Consider the current temperature and location as well.

Historical Temperature Data: {{{historicalTemperatureData}}}
Temperature Threshold: {{{threshold}}}
Current Temperature: {{{currentTemperature}}}
Current Location: {{{location}}}

Based on this information, determine if a temperature deviation is likely to occur, provide a detailed explanation, and suggest proactive measures to prevent spoilage.

Output:
predictedDeviation: (true/false) based on the analysis.
explanation: Detailed explanation of the prediction.
suggestedActions: List of actions to take to prevent the deviation.
`,
});

const predictiveTemperatureDeviationFlow = ai.defineFlow(
  {
    name: 'predictiveTemperatureDeviationFlow',
    inputSchema: PredictiveTemperatureDeviationInputSchema,
    outputSchema: PredictiveTemperatureDeviationOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
