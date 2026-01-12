'use server';

/**
 * @fileOverview This file defines a Genkit flow for summarizing detailed temperature and location reports.
 *
 * The flow uses an AI model to extract key events and anomalies from the reports, providing a concise summary
 * for quality assurance officers to quickly assess the cold chain's integrity.
 *
 * @interface GenerateReportSummaryInput - Defines the input schema for the generateReportSummary flow.
 * @interface GenerateReportSummaryOutput - Defines the output schema for the generateReportSummary flow.
 * @function generateReportSummary - The main function to trigger the report summarization flow.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// Define the input schema for the flow
const GenerateReportSummaryInputSchema = z.object({
  reportData: z
    .string()
    .describe(
      'Detailed report data including temperature readings and location data.'
    ),
});
export type GenerateReportSummaryInput = z.infer<typeof GenerateReportSummaryInputSchema>;

// Define the output schema for the flow
const GenerateReportSummaryOutputSchema = z.object({
  summary: z
    .string()
    .describe(
      'A concise summary of the key events and anomalies in the report.'
    ),
});
export type GenerateReportSummaryOutput = z.infer<typeof GenerateReportSummaryOutputSchema>;

/**
 * Asynchronously generates a summary of the provided report data.
 * @param input - The input data containing the detailed report.
 * @returns A promise that resolves to a summary of the report.
 */
export async function generateReportSummary(
  input: GenerateReportSummaryInput
): Promise<GenerateReportSummaryOutput> {
  return generateReportSummaryFlow(input);
}

// Define the prompt for the AI model
const generateReportSummaryPrompt = ai.definePrompt({
  name: 'generateReportSummaryPrompt',
  input: {schema: GenerateReportSummaryInputSchema},
  output: {schema: GenerateReportSummaryOutputSchema},
  prompt: `You are a quality assurance expert tasked with summarizing cold chain reports.
  Analyze the following report data and provide a concise summary highlighting key events,
  anomalies, and any deviations from the expected temperature range.

  Report Data: {{{reportData}}}

  Summary:`,
});

// Define the Genkit flow
const generateReportSummaryFlow = ai.defineFlow(
  {
    name: 'generateReportSummaryFlow',
    inputSchema: GenerateReportSummaryInputSchema,
    outputSchema: GenerateReportSummaryOutputSchema,
  },
  async input => {
    const {output} = await generateReportSummaryPrompt(input);
    return output!;
  }
);
