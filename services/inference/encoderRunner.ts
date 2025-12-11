import { Tensor } from "@huggingface/transformers";
import { logToWindow } from "./inferenceUtils";

/**
 * Helper to run the encoder, handling both standard transformers.js models
 * and manual session fallback if the wrapper is missing.
 */
export async function runEncoder(model: any, pixelValues: Tensor): Promise<any> {
  logToWindow("[beamSearch] Starting encoder check...");

  // Debug keys
  logToWindow("[beamSearch] Model keys:", Object.keys(model));
  if (model.sessions) {
    logToWindow("[beamSearch] Sessions keys:", Object.keys(model.sessions));
  }
  logToWindow("[beamSearch] model.encoder type:", typeof model.encoder);

  let encoderOutputs: any;

  if (model.encoder) {
    encoderOutputs = await model.encoder({
      pixel_values: pixelValues,
    });
    logToWindow("[beamSearch] Encoder ran via model.encoder(). Keys:", Object.keys(encoderOutputs));
  } else if (model.sessions) {
    // Fallback: search for encoder session
    logToWindow("[beamSearch] 'model.encoder' missing, attempting fallback to sessions...");
    const sessMap = model.sessions;
    const encSession = sessMap.encoder || sessMap.encoder_model || sessMap.model;

    if (encSession) {
      logToWindow("[beamSearch] Found encoder session, running manually...");
      try {
        // Direct session run. Assumes pixelValues is compatible or convertible.
        encoderOutputs = await encSession.run({ pixel_values: pixelValues });
        logToWindow("[beamSearch] Manual encoder run successful. Keys:", Object.keys(encoderOutputs));
      } catch (e) {
        logToWindow("[beamSearch] Manual encoder run failed:", e);
        throw e;
      }
    } else {
      throw new Error("[beamSearch] No encoder function AND no encoder session found in model.");
    }
  } else {
    throw new Error("[beamSearch] Model has no encoder and no sessions map.");
  }

  // Validate output
  if (encoderOutputs.last_hidden_state) {
    logToWindow(
      "[beamSearch] Encoder last_hidden_state dims:",
      encoderOutputs.last_hidden_state.dims
    );
  } else {
    logToWindow("[beamSearch] WARNING: No last_hidden_state in encoder outputs!");
  }

  return encoderOutputs;
}
