# Article Digest -- Proof Points (Rahul Gupta)

Compact measurable proof points extracted from `cv.md` and prior profile facts.

---

## Amazon -- Production Ranking Systems

**Hero metrics:** 10,000+ QPS, ~70% training runtime reduction, 60%+ incident reduction

**Architecture:** Built and maintained production ranking systems for Amazon search pages, backed by distributed PySpark feature pipelines and model deployment infrastructure.

**Key decisions:**
- Refactored and parallelized legacy Spark training workflows to remove bottlenecks.
- Added monitoring, alerting, and diagnostics to reduce recurring failures.
- Integrated LLM-assisted ranking exploration (Qwen 1.7B) with latency-quality analysis.

**Proof points:**
- Reduced end-to-end training runtime from about 9 hours to about 2.5 hours.
- Sustained ranking workflows serving 10,000+ QPS globally.
- Cut recurring ML pipeline incidents by over 60%.

---

## Sherpa Analytics -- LLM-Powered Semantic Search

**Hero metrics:** 1M+ records, 50%+ lookup latency reduction, 30% faster embedding/index pipeline

**Architecture:** Implemented semantic search backend with hybrid retrieval (vector search + structured SQL), LangChain-based RAG, and scalable Python API services.

**Key decisions:**
- Combined vector retrieval with structured query paths for reliability and speed.
- Optimized indexing and embedding workflows to shrink processing time.
- Kept APIs modular for analytics feature expansion.

**Proof points:**
- Scaled semantic search to over 1 million records.
- Reduced lookup latency from 60+ seconds to under 30 seconds.
- Reduced embedding/index pipeline time by about 30%.

---

## Indiana University -- Research ML Platforming

**Hero metrics:** Data scale from about 120K to 500K+ records, preprocessing time from about 45 minutes to under 13 minutes, training cycle from 10+ hours to about 6 hours

**Architecture:** Built GAN-based data generation workflows, FastAPI data services, and validation pipelines for synthetic vs real distribution checks.

**Proof points:**
- Expanded available climate training data more than 4x.
- Reduced large-batch data prep time by over 70%.
- Reduced model training cycle time by about 40%.
