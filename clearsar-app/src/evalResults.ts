// Evaluation data for the deployed SAR->optical model and its predecessors.
// Sources (Hugging Face, AliMusaRizvi/sar-to-optical-diffusion):
//   final_eval_results/full_eval_results.json — regressor v3 ("v3") vs bridge ("champion"),
//     same held-out test set, same protocol
//   regressor_*_final/bridge_config.json      — validation scores logged during training
//   eval_results/results.json                 — bridge_final step / resolution ablations
// and the training notebook (SAR_to_Optic_3.ipynb) for the earlier Phase A / ResShift models.
// Update together with backend/model/pipeline.py MODEL_CARDS if a model is re-evaluated.

export const MODEL_REPO = 'AliMusaRizvi/sar-to-optical-diffusion'
export const MODEL_NAME = 'regressor_v3_final'
export const MODEL_LABEL = 'Regressor v3'
export const MODEL_SUMMARY = 'Deterministic one-step regressor on the adapted 16-ch SD-1.5 latent, distilled from the Schrödinger bridge, with a fine-tuned decoder and CLIP season/terrain conditioning'
export const RESULTS_URL = `https://huggingface.co/${MODEL_REPO}/blob/main/final_eval_results/full_eval_results.json`
export const MODEL_URL = `https://huggingface.co/${MODEL_REPO}/tree/main/${MODEL_NAME}`
export const TRAIN_STEPS = 80_000
export const UNET_PASSES = 1
export const FIXED_TIMESTEP = 933

export interface Scores { psnr: number; ssim: number; lpips: number; fid?: number; sam?: number; cc?: number }

// Headline: same test set for both models.
export const HEADLINE: Scores = { psnr: 18.32291, ssim: 0.305748, lpips: 0.823229, fid: 215.4758, sam: 6.271559, cc: 0.389746 }
export const BRIDGE: Scores = { psnr: 16.68770, ssim: 0.257428, lpips: 0.767509, fid: 128.1497, sam: 7.592537, cc: 0.265224 }

export const BY_SEASON: { name: string; s: Scores; b: Scores }[] = [
  { name: 'Spring', s: { psnr: 17.617, ssim: 0.2740, lpips: 0.8400 }, b: { psnr: 15.900, ssim: 0.2282, lpips: 0.7848 } },
  { name: 'Summer', s: { psnr: 18.824, ssim: 0.3287, lpips: 0.7877 }, b: { psnr: 17.075, ssim: 0.2752, lpips: 0.7489 } },
  { name: 'Fall',   s: { psnr: 18.887, ssim: 0.3283, lpips: 0.7986 }, b: { psnr: 17.477, ssim: 0.2903, lpips: 0.7449 } },
  { name: 'Winter', s: { psnr: 17.929, ssim: 0.2909, lpips: 0.8627 }, b: { psnr: 16.190, ssim: 0.2324, lpips: 0.7919 } },
]

export const BY_TERRAIN: { name: string; s: Scores; b: Scores }[] = [
  { name: 'Temperate', s: { psnr: 18.683, ssim: 0.3314, lpips: 0.8235 }, b: { psnr: 17.119, ssim: 0.2889, lpips: 0.7587 } },
  { name: 'Tropical',  s: { psnr: 18.118, ssim: 0.2935, lpips: 0.8192 }, b: { psnr: 16.450, ssim: 0.2406, lpips: 0.7695 } },
  { name: 'Arctic',    s: { psnr: 18.036, ssim: 0.2665, lpips: 0.8534 }, b: { psnr: 16.279, ssim: 0.2240, lpips: 0.7980 } },
]

// Regressor lineage: validation scores logged at the end of each training run
// (each version starts from the previous one).
export const REGRESSOR_LINEAGE: { name: string; steps: number; s: Pick<Scores, 'psnr' | 'ssim'>; note: string }[] = [
  { name: 'v1', steps: 30_000, s: { psnr: 17.063, ssim: 0.2851 }, note: 'one-step regressor from the bridge' },
  { name: 'v2', steps: 40_000, s: { psnr: 17.449, ssim: 0.2905 }, note: 'shift-tolerant + MIND/SAM/L1 losses, EMA' },
  { name: 'v3', steps: 80_000, s: { psnr: 17.668, ssim: 0.3110 }, note: 'adds SSIM loss + decoder fine-tune' },
]

// Earlier approaches from the training notebook, for context (PSNR dB / SSIM / LPIPS).
export const MODEL_HISTORY: { name: string; note: string; s: Scores; current?: boolean }[] = [
  { name: 'Phase A', note: 'DDPM, 50 steps', s: { psnr: 10.6, ssim: 0.055, lpips: 0.772 } },
  { name: 'ResShift', note: '180k steps', s: { psnr: 12.5, ssim: 0.154, lpips: 1.006 } },
  { name: 'Bridge', note: '15 steps, I2SB', s: BRIDGE },
  { name: 'Regressor v3', note: '1 step, deployed', s: HEADLINE, current: true },
]
// Published colour-supervised diffusion result the notebook compares against.
export const SOTA_REF: Scores = { psnr: 19.7, ssim: 0.312, lpips: NaN }
