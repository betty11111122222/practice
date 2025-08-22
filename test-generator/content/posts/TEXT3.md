---
title: 一文读懂 AI Search：从 RAG 到 DeepSearch
description: AI Serach
date: 2025-08-08T02:57:00.000Z
---
> 本文由 [简悦 SimpRead](http://ksria.com/simpread/) 转码， 原文地址 [blog.csdn.net](https://blog.csdn.net/csdnnews/article/details/149950039?spm=1000.2115.3001.5927)

![](https://i-blog.csdnimg.cn/img_convert/39e3b788a0b7dc259515a8804b64a13a.gif)

太长别读（TL;DR）

为了应对 LLMs 内在知识的有限性，检索增强技术 RAG（AI + Search）应运而生。然后随着模型能力（推理能力和工具调用能力）的不断发展，RAG 也在逐渐从死板的人类工程向[灵活的](https://so.csdn.net/so/search?q=%E7%81%B5%E6%B4%BB%E7%9A%84&spm=1001.2101.3001.7020)模型自主性过渡，即更加 Agentic 了（智能体），比如兴起的新概念 DeepSearch。智能体的自主性面临着知识边界问题和能力边界问题，这两个边界问题也分别对应着模型知识和能力拓展的两大利器：信息和工具。无论是边界问题还是拓展利器，对模型本身的能力（尤其是深度思考推理能力）要求都很高。相应地，模型训练范式也在逐渐从有监督微调向强化学习后训练过渡。以 AI Search 或者 Search Agent 为基础，其他各种 Coding Agent、Browser Agent 等智能体百花齐放，并且未来的趋势是通用型智能体。

作者 | 雷孟  

出品 | 腾讯云开发者

![](https://i-blog.csdnimg.cn/img_convert/732924395199c17305252b868ba28aa7.png)

需求背景：模型内在知识的有限性

模型的内在知识是经过训练从大量数据中学习得到的。但是训练数据总是有限的，它的有限性主要体现在两个方面：

1、训练数据的收集有截止日期（cut-off）限制，无法囊括超过过截止日期的的新生数据，即模型的内在知识有严格的时效性问题，相应地，模型也就不适合回答对时效性要求很高的问题；

2、训练数据通常是公开的，而私域数据通常无法收集到，即便训练方可以利用自己的专有数据或者购买到一些专有数据，总还 “隐藏着” 很多没有被挖掘或者无法挖掘的私域数据，所以如果没有见过具体垂直领域的保密数据，模型通常在某个公司内部具体业务上表现不佳。

新生数据和私域数据也可以认为是 “长尾信息”，这种看法其实主要是对从这些数据有需求的人群分布来看的，毕竟相比全体人类而言，某个公司的某个业务的专有数据的需求方和使用方总是极少数的。

训练数据的这两个局限性，可以统一落脚到数据分布的有限性，进而延伸至模型的泛化性问题，也是机器学习领域一直待解决的 超出分布（OOD out-of-distribution） 问题，尤其是遇到长尾信息时。我认为 OOD 问题和泛化性本质上是一个概念，可以看作是 “一体两面”，OOD 说明的是一种现象，即测试数据分布与训练数据的分布不同，也称为超出了训练数据的分布；而泛化性是说在这一现象下的表现，模型在未见过的数据分布上的性能出现了下降，也即是模型的性能存在泛化性问题。

![](https://i-blog.csdnimg.cn/img_convert/05d623e043f3efa903192facc6b6093a.png)

解决方法：通过知识检索来增强

相应地，模型内在知识也是有限的，通常有 2 种解决方法：一种是需要训练，也即发生在训练阶段，另一种不需要训练，通常发生在推理阶段。

前者很好理解，我们可以将新生数据或者私域知识作为新的数据集去继续预训练或者后训练微调模型，从而将新的知识注入到模型中。

而后者是在推理阶段直接将新的知识输入到模型的上下文中，然后模型通过充分利用其本身的上下文学习（in-context learning）能力，根据给定上下文信息去更好地回答用户问题。这里所讲的上下文学习能力不仅仅局限于无训练（training-free）的多样本学习（few-shot learning）能力，还包括更广泛的指令遵循（instruction following）能力。而且输入的新知识与当前任务和用户当前具体输入的问题是密切相关的。

具体的新知识又可以分为 2 种：

1、通用的知识，即适用于当前任务和用户所有问题，这种知识可以直接一次性固定放在模型的系统提示词中；

2、特定问题的知识，即直接与每个具体问题相关联，这种知识通常需要使用用户当前问题通过信息检索技术从相应知识库中召回相关知识，然后再与当前问题一块放在用户提示词中——这种方式也即是如今常见且通用的检索增强生成（RAG Retrieval-Augmented Generation）技术。

![](https://i-blog.csdnimg.cn/img_convert/6461064bd3221fb7bb9d8882c0c4650e.png)

RAG 演化的 3 个阶段

RAG 演化总览图如下所示：

![](https://i-blog.csdnimg.cn/img_convert/850b37a7ffc8639e9ffae2548c496750.png)

3.1 简单的固定 2 步骤

RAG 最开始采取的是一个简单明了的固定流程，即先检索再生成。而且每次固定先检索一次，通常整体执行一轮。

![](https://i-blog.csdnimg.cn/img_convert/f85182b2aaffa599731de077bb13ee1a.png)

3.2 优化用户问题和检索技术

然后为了提升检索效果，也即是为了最终的生成效果，开始从 2 个方向进行优化，分别是用户问题和检索技术。

前者是通过一些传统 NLP 或者直接使用 LLMs 对用户的原始问题进行优化，优化的直接目的是提升召回率，具体的方法有很多种，初级的方法有规范化、改写、扩展等，需要用于文本检索，高级的方法有假设文档（Hypothetical Document ）、上下文适应（Context Adaptation）等，主要用于语义检索。

*   假设文档是使用 LLMs 生成的假设可以回答用户问题的文档，其核心理念是拉近查询问题与索引文档之间的距离，也可以认为是将查询与文档（query vs document）的不对称检索（retrieval）转换成假设文档与目标文档之间的对称文本相似匹配（text similarity matching TSM 或者 semantic textual similarity STS）。
    
*   上下文适应的目的是使用户问题适应当前上下文（包括任务、提示、补充知识等），使其自身更加具有完整性（包含相关上下文）和独立性（自洽，不需要其他说明），整体也可以称之为 “上下文落地”（context grounding）。如此优化后的查询问题可以更好地定位到符合上下文并且与当前用户问题相关的知识。其中有一种与这一理念相通的具体方法——退一步提示（https://arxiv.org/abs/2310.06117）。 退一步的核心思想是从具体问题和具体细节出发，通过抽象化处理得到高层次的概念或者第一性原理，即从更高层更抽象的角度来看问题。其实它就是引导 LLMs 先思考相关背景基础知识（先做背景调查，显式地将前置依赖提供出来），再回答当前的具体问题。虽然退一步提示是作为一种提示工程方法被提出来的，但是其理念和特性可以很好地应用于上下文适应任务上来优化用户问题。
    

后者优化检索技术，从基础的文本检索、向量检索、混合检索乃至知识图谱检索，到使用交叉编码器（cross-encoder）进行重排，再到使用 LLMs 甚至推理模型进行重排。

这两者是相辅相成的，通常需要前后搭配使用，以达到最好的效果。

3.3 从固定工作流到自主智能体

但是这两个阶段都还是人工设计为主，整体流程虽然更复杂了但基本也还是固定的。最后随着推理模型的出现和发展壮大，RAG 从逐渐升级到 Agentic RAG，即从之前的人为设计好的固定工作流程慢慢进化到更加自主的智能体系统。智能体自主性的第一个层面是直接根据当前的上下文信息经过推理（深度思考）然后直接决定下一步执行检索的问题和检索策略。其中可用或者建议的用户问题优化策略和可用的检索配置都直接通过上下文信息暴露给模型，模型在深度思考阶段推理和决定合适或者最佳的优化策略，即利用模型强大的推理能力（深度思考能力）自主地完成优化。第二个层面是模型可以根据之前的执行结果自主地判断是否还需要继续搜索以及还有哪些需要进一步探索的缺失之处，这样整个智能体系统可以循环多次搜索步骤直到收集到足够的上下文信息来回答用户最初的问题。

Agentic RAG 的整体框架本质上其实是推理模型兴起之前的 ReAct 框架（https://arxiv.org/abs/2210.03629），而现如今有了推理模型的加持。不仅如此，最近非常流行的 DeepSearch 和 DeeppResearch 也主要基于 ReAct 框架。其实无论是最开始的朴实 RAG，还是如今的 Agentic RAG 抑或 DeepSearch 和 DeepResearch，都可以统称为 AI Search，即通过 AI 技术来搜索外部知识来为 LLM（更好地）回答用户问题补充上下文信息。Jina AI 也在博客《A Practical Guide to Implementing DeepSearch/DeepResearch》（https://jina.ai/news/a-practical-guide-to-implementing-deepsearch-deepresearch）中指出：其实 DeepSearch 和 DeepResearch 都算是对 RAG 的 “品牌再造”（rebranding），即一种商业手段。

当然，现在的 Agentic RAG 或者 AI Search 已经不仅仅借助于检索来增强回答，LLMs 的工具调用（Tool / Function Calling）能力更能够拓展模型的能力边界。所以可以将如今的 Agentic RAG 中的 “R”（Retrieval）统一替换成 “T”（Tool），即 TAG（Tool-Augmented Generation）。同时我又发现一个新的说法 “集成工具的推理”TIR（Tool-Integrated Reasoning），比如 ToRA: A Tool-Integrated Reasoning Agent for Mathematical Problem Solving（https://arxiv.org/abs/2309.17452）。这个说法将之前的生成 Generation 升级为了推理 Reasoning，以突出推理模型（reasoning models），同时使用集成 Integreated 替换了之前的增强 Augmented，突出模型的推理能力与工具调用能力之间的有机融合（integration）和协同作用（synergy），即推理能力思考调用哪个工具以及如何调用所选工具，工具调用的结果返回到模型的上下文中指导下一步更好的推理，并且循环往复。

![](https://i-blog.csdnimg.cn/img_convert/7729e57802cd68772be2be277f476805.png)

模型的推理能力和工具调用能力极大地升级强化了 ReAct 框架的自主性，之前的工作流 Workflow 也就进化到了智能体 Agent。而引入了智能体的概念后，我们就可以从强化学习（Reinforcement Learning）的角度来理解和分析如今围绕 LLMs 构建的智能体系统。而且，众所周知，推理模型本身就是通过强化学习算法后训练得到的。

![](https://i-blog.csdnimg.cn/img_convert/6991b89a53dc222fc7a5046fd7cee87a.png)

Agentic RAG 所面临的边界条件

智能体的自主性（autonomy）固然好，但是面临着 2 个边界条件：知识边界和能力边界，并且二者息息相关。

知识边界很好理解，正如我们开头讲到的模型的内在知识是有限的，也即是有边界的，但是在面对具体的用户任务和问题时，这个边界具体在什么位置呢？这是一个非常具有挑战性的问题。如果人工可以精准定位模型知识边界的话，则我们通常不会去让模型来推理判断。因为后者本身具有随机性，而且还有尚待缓解乃至解决的幻觉问题。举个通俗的例子，如果我们可以使用计算器完成计算的话，则不会也不建议去使用大模型。而我们现在转向大模型来判断知识边界就是因为人造的规则有局限性，比较死板而且不灵活，需要持续不断地人工投入。而大模型（尤其推理模型）本身能力很强，而且也在不断地得到增强。总的来说，大模型的上限很高拓展性很强，又非常灵活，可以适应不同的任务场景和输入输出。所以使用大模型来推理（深度思考）其自身内在知识是否足以回答当前问题以及内在知识与当前问题之间还有哪些差距需要弥补，然后去针对性地获取外部知识。整个过程很像是一个人在被人提问时回想和思考脑海里已有的知识，如果没有相关知识储备和治理，则需要请求外援，比如上网搜索或者咨询内行专家。

能力边界是指大模型的能力是有限的，类似大模型主动获取外部知识来弥补其内在知识与当前问题之间的差距，我们也希望大模型能够判断其自身能力与当前任务需求之间的差距然后主动请求外部工具来弥补能力缺陷。比如大模型的计算能力有限，当遇到数值计算乃至通用的程序执行任务时，最好的解决方式是调用相应的工具（计算器或者代码解释器）。而人类就是这么做的，典型地，计算器或者更通用且强大的计算机可以弥补人类在计算方面的不足或者拓展人类的计算能力。

其实从某种程度上来说，知识边界也是能力边界的一种，毕竟人类通常也将 “好记性” 作为一种个人能力。知识边界主要关注理论知识层面的不足，能力边界主要关注实践能力层面的短板。事实上，获取外部知识是需要使用外部工具的，具体使用哪些工具以及如何使用工具属于能力边界的范畴。然后获取的知识再输入到模型中，用来反哺知识边界，而有了更多知识（更多上下文信息）也有益于工具的选择。单独将知识边界独立出来是因为知识是理论基础，其他实践工具是能力拓展。正所谓“巧妇难为无米之炊”，一个厨师再精通各种厨具和熟悉各种烹饪技巧，但是没有米也就“英雄无用武之地”。相应地，好的食材更能展现厨艺，二者是相辅相成相得益彰的。

从强化学习的角度来看，一个智能体与外界环境交互的通用范式是先进行广度探索再进行深度挖掘（exploration before exploitation）。其实这种范式也就先后分别对应知识边界和能力边界。

与计算机做一个类比，中央处理器（CPU）负责计算，具体数据保存在内存里，如果内存放不下则还有外存，CPU 从内存读取数据，如果内存没有则需要从外存读取，然后启动处理流程，其自身可以执行一些计算，如果处理不了则需要调用其他工具，最后再将处理后的数据写回内存，如果内存放不下则还需要写到外存中，循环往复直到任务完成。

智能体的内存就是其内在知识，外存是互联网、教科书或者内行专家。如果内存中的内在知识不够，则需要从外存中获取外部知识，即知识边界。大模型 LLMs 非常善于文本处理（自身的看家本领），但是对于数值计算和代码执行（可以统称为计算能力）并不擅长，即能力边界。这个时候，就需要请求外部工具的帮助。经过内外部工具处理后的信息如果比较多或者没有长度没有超出 LLMs 的上下文窗口大小，则可以直接放在模型的上下文中（即内存中）；相反如果太长或者超出了 LLMs 的上下文窗口大小，则需要保存在外部知识库中（即外存中）。

![](https://i-blog.csdnimg.cn/img_convert/cc3fc12f69fcc7453e186877597772d7.png)

DeepSearch

有了信息和工具之后，再加上一个智慧大脑（推理模型），我们就很自然地得到了深度搜索（DeepSearch）。目前 DeepSearch 或者 DeepResearch 的论文和应用有很多 (OpenAI Deep Research、Anthropic Multi-Agent Research System、JinaAI Deep(Re)Search Guide、Kimi-Researcher、ByteDance DeerFlow、Google Gemini Search Agent 等），总体的技术范式和实现大同小异，与前文所讲的 Agentic RAG 基本一致，这里不再一一赘述。

下面我们可以看一下 Jina AI 和 Google Gemini 的方案，二者整体都很简洁，主要面向 AI Search 垂直领域。整个智能体系统的核心仍然是推理模型及其深度思考能力，具体在 AI Search 领域，该深度思考能力用来思考判断当前上下文是否足够回答用户问题以及如果不够的话生成后续的检索问题（即 gap 问题）。除此之外，AI Search 通常只有一个检索工具，用来获取外部知识。

Jina AI 深度搜索的实现：

![](https://i-blog.csdnimg.cn/img_convert/8672c3e8b84bf964baac139bfe5da0b9.png)

Google Gemini Search Agent 框架示意图：

![](https://i-blog.csdnimg.cn/img_convert/6ac6ac07d2f507c571dbb67f70d68ef7.png)

如果再加入和拓展一些信息检索之外的工具，比如代码解释器、计算机系统或软件控制等工具，那么就可以得到 Coding Agent（比如 Cursor、Trae、Cline、Github Copilot 等）、Browser Agent（比如 Fireworks Broswer Agent）、Computer Agent（比如 OpenAI Computer Use 和 Anthropic Computer Use）等垂直应用 Agent。

总的来说，AI Search 是其他垂直 AI 应用 Agent 的前置依赖和基础。同理，以人类为例，阅读是创作的基础和前提。具体地说，AI Search 主要用来阅读（read），而其他智能体（比如 Coding Agent）的主要目的是创作（write）。LangChain 的博客《How and when to build multi-agent systems》（https://blog.langchain.com/how-and-when-to-build-multi-agent-systems/）中提到以阅读为主的多智能系统通常比以创作为主的多智能体系统更加容易些。这个很好理解，普通人通常可以阅读四大名著，钻研深入的读者也理解更深度些，但是现实是绝大多数人是写不出来类似四大名这种经典作品的。原创或者自研比阅读和使用要高几个维度。类似地，生成对抗网络（GAN）中生成器（generator）通常比判别器（discriminator）的参数量更大，一个小的 LLM 可以用来评估另外一个参数量更大的 LLM 的生成内容。

![](https://i-blog.csdnimg.cn/img_convert/7b56342ff07c00a9bc54c0484007dd4d.png)

从工作的角度来看，阅读（学习）不是目的，创作（干活）才是。创业公司 Cognition AI 发布的 DeepWiki 产品支持对一整个代码仓库进行问答甚至 DeepResearch，即让 AI 来帮助我们进行代码阅读和理解，即 AI Search。同时这个创业公司发布的 Coding Agent 产品 Devin 号称为全球首个 AI 软件工程师，即让 AI 充当或者替代人类去编写软件，即 AI Coding。

![](https://i-blog.csdnimg.cn/img_convert/c1b52da2722411b4b0b10fa1dfbdf0a1.png)

总结与展望

从长期来看，LLMs 内在知识的有限性会一直存在，相应地，检索增强的需求也一直都会存在。从最初朴素的 RAG 方案，到加入了很多人工设计（各种查询检索优化和工具调用）的精密复杂的 RAG 工作流，再到围绕推理能力（推理模型）构建的具有自主性的 Agentic RAG（比如 DeepSearch），AI Search 的目的没有改变，变化的是模型能力（推理能力和工具调用能力）和设计范式（从死板的人类工程到灵活的模型自主性）。

当然，也是得益于模型能力的提升才更好地驱动了设计范式的升级。而且这种范式升级非常契合 Rich Sutton 的《苦涩的教训》，即从长期来看通过搜索和学习来扩展计算量的通用型方法胜过以人为中心的方法，其中学习就是训练（大模型的 scaling law）。

智能体系统自主性面临着 2 个边界问题，即知识边界和能力边界，也分别对应 LLMs 应用的 2 大抓手：信息和工具。从目前来看，大（语言）模型仍然是数据驱动的，所以要想解决这 2 个边界问题，仍然需要从训练数据着手，进行针对性的[模型训练](https://so.csdn.net/so/search?q=%E6%A8%A1%E5%9E%8B%E8%AE%AD%E7%BB%83&spm=1001.2101.3001.7020)。同时考虑到信息空间和工具库都是不断扩展的，环境是动态的（dynamic），并且与环境交互是多轮或多步的（long horizon），目前的训练方式也从有监督微调（SFT）逐步升级进化到强化学习（RL）后训练，以获得更好的自主性、泛化性、灵活性，比如 Search-R1、ReSearch、Kimi-Researcher、SimpleTIR、Alibaba Web Agent 系列等。正所谓授人以鱼不如授人以渔，SFT 更像是前者的授人以鱼，而 RL 更像是后者的授人以渔。

诚如月之暗面在技术博客《Kimi-Researcher: End-to-End RL Training for Emerging Agentic Capabilities》中提到的未来愿景：从一个专注于搜索与推理的智能体，逐步演化为能够运用不断扩展的工具集解决各类复杂任务的通用型智能体，这和迈向通用人工智能（AGI）的愿景也是一致的。

参考文献

*   《OpenAI Deep Research》
    
    https://openai.com/index/introducing-deep-research/
    
*   《Anthropic Multi-Agent Research System》
    
    https://www.anthropic.com/engineering/built-multi-agent-research-system
    
*   《JinaAI Deep(Re)Search Guide》
    
    https://jina.ai/news/a-practical-guide-to-implementing-deepsearch-deepresearch/
    
*   《Kimi-Researcher》
    
    https://moonshotai.github.io/Kimi-Researcher/
    
*   《ByteDance DeerFlow》
    
    https://deerflow.tech/
    
*   《Google Gemini Search Agent》
    
    https://github.com/google-gemini/gemini-fullstack-langgraph-quickstart
    
*   《A Practical Guide to Implementing DeepSearch/DeepResearch》
    
    https://jina.ai/news/a-practical-guide-to-implementing-deepsearch-deepresearch/
    
*   《How and when to build multi-agent systems》
    
    https://blog.langchain.com/how-and-when-to-build-multi-agent-systems/
    
*   《Kimi-Researcher: End-to-End RL Training for Emerging Agentic Capabilities》
    
    https://moonshotai.github.io/Kimi-Researcher/
    

感谢你读到这里，不如关注一下？👇