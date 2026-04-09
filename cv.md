# Rahul Gupta — Master Resume (Canonical)

**Email:** gupta.rahul7425@gmail.com | **Phone:** +1 (812) 778-5987 | **Location:** California, USA

---

## Professional Summary

Machine Learning and Software Engineer with 2+ years of experience building production-scale AI and ML systems for high-traffic platforms. At Amazon, I engineer large-scale ML ranking systems serving 10K+ QPS globally and maintain distributed PySpark pipelines processing tens of terabytes of daily interaction data. Deep expertise in ranking and recommendation systems, LLM integration, RAG pipelines, ML deployment infrastructure, and scalable Python and Java backends. Proven track record of measurable impact: reduced model training runtime by ~70%, cut pipeline incidents by 60%+, and accelerated semantic search latency by 50%+.

---

## Experience

### Amazon — Software Development Engineer
**Dec 2024 – Present | USA**

- Engineered and maintained two production ML ranking systems for widget ranking and page template ranking on Amazon's global search page, serving **10,000+ QPS** across worldwide storefronts.
- Built and maintained distributed **PySpark** feature engineering pipelines processing **tens of terabytes** of daily user interaction data to support ranking model training and inference.
- Optimized a legacy Spark-based model training pipeline, reducing end-to-end runtime from **~9 hours to ~2.5 hours** (~70% reduction) through parallelization, caching, and code refactoring.
- Strengthened ML pipeline reliability via monitoring, automated alerting, and diagnostics, reducing recurring incidents by **60%+**.
- Developed and operated production deployment infrastructure for ranking models, including rollout validation, performance dashboards, and rollback mechanisms.
- Contributed to LLM-based ranking research by integrating **Qwen 1.7B** into final-stage ranking workflows and conducting latency-quality tradeoff analyses.

---

### Sherpa Analytics Inc — Generative AI Engineer
**Aug 2024 – Dec 2024 | USA**

- Built backend services for an **LLM-powered analytics platform** enabling semantic search across hospitality datasets with **1M+ records**.
- Designed a hybrid retrieval system combining **vector search** and SQL-based structured queries, reducing average data lookup time from **60+ seconds to under 30 seconds** (~50% improvement).
- Developed **RAG pipelines** using **LangChain** and vector databases to deliver context-aware responses over large structured and unstructured datasets.
- Implemented scalable **Python inference services** and REST APIs supporting AI-driven analytics features for internal stakeholders.
- Optimized embedding generation and indexing workflows, reducing data processing time by **30%**.

---

### Linqd — Machine Learning Engineer
**Oct 2024 – Nov 2024 | USA**

- Processed and analyzed **50,000+ data points** using SQL and PySpark for customer segmentation and behavioral analysis.
- Built machine learning models for **account scoring** and **customer lifetime value (CLV)** prediction.
- Developed **multi-touch attribution models** for marketing channel performance evaluation.

---

### Indiana University — Machine Learning Engineer (Research)
**May 2024 – Jul 2024 | USA**

- Developed GAN-based generative models using Python and PyTorch to synthesize time-series CO₂ emission datasets for more than 10 geographic regions, expanding available training data from ~120K to over 500K records to support large-scale ML experimentation.
- Built scalable REST APIs using Python and FastAPI to enable configurable access to synthetic and historical emissions datasets supporting more than 15 machine learning training and evaluation workflows and reducing manual data preparation by about 20 engineering hours per month.
- Implemented end-to-end data preprocessing and feature engineering pipelines using Pandas and NumPy for multi-regional climate datasets, reducing data preparation time from about 45 minutes to under 13 minutes for large model training batches.
- Designed model validation workflows comparing synthetic and real emission distributions using KL divergence and Wasserstein distance, improving reliability of generated datasets for downstream climate prediction research.
- Optimized GAN model training using GPU-accelerated environments and modular ML scripts, reducing training cycle time from more than 10 hours to around 6 hours (~40% reduction), enabling faster model experimentation and research iteration.

---

### PwC India — Software Engineer Intern
**May 2023 – Jul 2023 | India**

- Developed a Python-based host activity monitoring system to analyze security telemetry across 50+ enterprise hosts enabling automated detection of suspicious system behaviors and improving security visibility for internal audit teams.
- Designed and implemented an automated network log ingestion pipeline using Python and ClickHouse processing more than 1,000 security events per day and reducing manual log analysis workload by approximately 40% for cybersecurity analysts.
- Engineered scalable data processing scripts to normalize and aggregate network and host activity logs improving incident investigation speed and reducing troubleshooting time by nearly 6 hours per week.
- Optimized log storage and query performance in ClickHouse enabling faster security analytics queries and improving threat investigation turnaround time for security operations teams.
- Collaborated with cybersecurity and infrastructure teams to validate monitoring rules and improve threat detection coverage across enterprise systems.

---

## Education

**MS in Computer Science** — Indiana University Bloomington | Aug 2022 – May 2024

**BTech in Computer Science and Engineering** — Manipal Institute of Technology | Jul 2018 – Jun 2022

---

## Certificates

- Data Analysis with Python — IBM
- Database and SQL for Data Science — IBM
- Python for Data Science and AI — IBM
- Data Science Methodology — IBM
- Data Science Tools — IBM
- Data Science Orientation — IBM
- R Programming A-Z — SuperDataScience

---

## Skills

**Programming Languages:** Python, Java, Scala, TypeScript, SQL

**Machine Learning & AI:** Machine Learning Systems, ML Model Development, Model Training and Evaluation, Feature Engineering, Model Deployment, Model Serving, ML Experimentation, Generative AI, Large Language Models (LLMs), Retrieval Augmented Generation (RAG), GANs

**ML Infrastructure & Systems:** ML Pipelines, Feature Engineering Pipelines, Ranking Systems, Recommendation Systems, Distributed Machine Learning Systems, LLM Inference Systems, Production ML Systems

**Data Engineering & Big Data:** Apache Spark, PySpark, Pandas, NumPy, Large Scale Data Processing, ETL Pipelines, Data Pipelines, Batch Processing

**Frameworks & Tools:** PyTorch, LangChain, FastAPI, REST APIs, Vector Databases

**Cloud & Infrastructure:** AWS (EMR, S3, EC2), Google Cloud Platform (GCP), CI/CD, Monitoring, Model Deployment Infrastructure

**Databases & Storage:** PostgreSQL, MySQL, ClickHouse, SQL

---

## Projects

### Distributed Key-Value Store | Advanced Distributed Systems
- Designed and implemented a distributed key-value store supporting strong, causal, and eventual consistency models, leveraging version vectors for causal ordering and conflict resolution.
- Built a replicated storage system across 20+ nodes with efficient synchronization and distributed request routing, enabling high concurrency for read/write operations.
- Conducted performance benchmarking and analysis across different consistency configurations, optimizing system reliability, latency, and scalability.
- Tech Stack: Python, Distributed Systems, Version Vectors, REST APIs, Multithreading/Concurrency, System Design

### Interview Blogs — Full-Stack Interview Experience Platform
- Built a full-stack web platform for sharing and browsing software interview experiences, serving 150+ registered users and 200+ posts.
- Implemented JWT-based authentication, RESTful APIs (Node.js/Express), and optimized SQL queries for content filtering and threaded discussions.
- Documented all endpoints with Swagger; deployed on Azure with AivenDB as the managed database backend.
- Tech Stack: Node.js, Express, React, JWT, SQL, AivenDB, Swagger, Azure

### Fit Friend — Fitness & Wellness Tracking Application
- Engineered a MERN-stack wellness platform with role-based access control (RBAC), personalized dashboards, content search, and live-streaming.
- Designed the REST API backend and MongoDB data layer to support 300+ concurrent users; managed delivery with JIRA across team sprints.
- Tech Stack: MongoDB, Express, React, Node.js, REST API, Git, JIRA

### Clinical Report Generation System | Generative AI
- Developed a Generative AI system to automatically generate structured clinical reports from electronic health records and medical notes.
- Implemented a Retrieval Augmented Generation (RAG) pipeline to improve accuracy of diagnostic summaries using clinical datasets and vector-indexed document retrieval.
- Built scalable APIs to generate patient summaries, discharge reports, and treatment recommendations for healthcare systems.
- Tech Stack: Python, PyTorch, Hugging Face Transformers, LangChain, FastAPI, Docker, AWS
