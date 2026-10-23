---
hide:
  - toc
---

# Machine Learning

Applying machine learning to materials discovery, starting with superconductors.

---

## High-Entropy Superconductor Tc Prediction

Predicting the critical temperature (Tc) of high-entropy alloy (HEA)
superconductors from composition alone is an open challenge. Existing tools
predict Tc but ignore a practical question: will the alloy even form a stable
single-phase structure? We built a two-stage ML pipeline that answers both.

**Stage 1: Phase stability classifier.** An Extra Trees model trained on
11,247 experimentally observed HEA compositions (Peivaste et al., *Sci Rep*
2023) predicts whether a given formula will form a single-phase BCC solid
solution: the structure where nearly all known HES superconductors live.
The classifier achieves 96% accuracy on BCC identification and 83% across
six phase categories (BCC, FCC, BCC+FCC, intermetallic, amorphous, mixed).

**Stage 2: Tc predictor.** Six regression models (Extra Trees, Random Forest,
Gradient Boosting, XGBoost, SVR, KNN) trained on 66 HES compositions using
138 Magpie composition-derived features via matminer. The best model (Extra
Trees) reaches R² = 0.60 under cross-validation, sufficient for ranking
candidates and guiding experimental priorities.

The combination is the key contribution: the phase gate filters out
compositions unlikely to form a stable single-phase alloy before Tc is
predicted, reducing misleading estimates and focusing attention on
experimentally viable candidates.

[→ Tc Prediction Tool](hes-tc-predictor/index.html){ .md-button }

---

## Inverse Design for Predicting High-Tc HES Compositions

The forward predictor answers "what is the Tc of this alloy?", but the
experimentalist's real question is the inverse: "which alloys will superconduct
near my target temperature?" We built an inverse design pipeline that
systematically screens the HEA composition space and returns verified candidates.

**How it works:**

1. **Enumerate** all equimolar 4-, 5-, and 6-element combinations from a pool
   of 10 refractory metals (Nb, Ta, Ti, Zr, Hf, V, Mo, W, Re, Ru): 672
   candidates total.
2. **Phase gate**: filter to compositions with P(BCC) ≥ 0.7 using the
   11,247-sample phase classifier.
3. **Multi-model Tc prediction**: all 6 trained models predict each candidate
   independently.
4. **5-check verification gate**: every candidate must pass ALL checks before
   display:
    - Phase stability (P_BCC ≥ threshold)
    - Cross-model agreement (σ ≤ 2.0 K)
    - Physical bounds (Tc within search range)
    - VEC range validation (3.5–7.5)
    - Novelty check (not already in training data)
5. **Score & rank**: candidates are ranked by a composite score weighting
   proximity to target, phase stability, and prediction confidence.

The user enters a target Tc and adjustable thresholds; the system returns the
top 10 most promising verified compositions in under 5 seconds.

[→ Inverse Design Tool](hes-inverse-design/index.html){ .md-button }

---

## Carbon Supercapacitor Inverse Design

Supercapacitor performance depends on a complex interplay of electrode
physicochemical properties: surface area, pore geometry, heteroatom doping,
and testing conditions. We built a physics-informed ML system that both
predicts specific capacitance from electrode features and solves the inverse
problem: given a target capacitance, what electrode parameters should be
synthesised?

**Forward model: Physics-Informed GPR.** A Gaussian Process Regressor with
a custom kernel encoding the Gouy-Chapman-Stern prior (capacitance ∝ SSA)
predicts specific capacitance (F/g) with calibrated uncertainty estimates.
A Gradient Boosting model serves as benchmark and enables SHAP-based feature
importance validation against known electrochemistry.

**Inverse design: Bayesian Optimisation.** The GPR posterior is used as the
surrogate in a Bayesian Optimisation loop with Expected Improvement
acquisition. Given a target capacitance, the system searches the
physicochemical parameter space under physical constraints (SSA_micro ≤ SSA,
pore size ≥ 0.3 nm) and returns the top electrode material configurations
most likely to achieve the target.

**Physics-backed feature engineering:** Seven derived features grounded in
EDLC theory (micropore fraction, pore density proxy, SSA–N synergy,
heteroatom total, defect-surface coupling, window², rate penalty) augment
the raw inputs and improve interpretability.

[→ Supercapacitor Design Tool](supercapacitor-design/index.html){ .md-button }
