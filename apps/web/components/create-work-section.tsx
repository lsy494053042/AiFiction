"use client";

import { useEffect, useId, useState } from "react";

import { createWorkAction } from "../app/workbench-actions";
import styles from "./create-work-section.module.css";

interface CreateWorkSectionProps {
  triggerLabel?: string;
}

const text = {
  trigger: "+ 新建作品",
  title: "先把这本书建起来",
  copy: "先填书名、题材、平台和一句话卖点。正文、大纲和设定，进作品页再继续补。",
  close: "关闭",
  titleLabel: "作品标题",
  titlePlaceholder: "例如：你的新书名",
  genreLabel: "主类型",
  genrePlaceholder: "玄幻 / 都市 / 悬疑",
  platformLabel: "目标平台",
  platformPlaceholder: "起点中文网 / 番茄小说",
  taglineLabel: "一句话卖点",
  taglinePlaceholder: "一句话说清这本书为什么值得追下去",
  advanced: "补充高级信息",
  slugLabel: "slug",
  slugPlaceholder: "不填则自动生成",
  subgenreLabel: "副类型",
  subgenrePlaceholder: "规则怪谈 / 废土悬疑 / 群像",
  targetWordCountLabel: "目标字数",
  dailyWordTargetLabel: "日更目标",
  cadenceLabel: "更新节奏",
  cadenceValue: "日更",
  audienceLabel: "目标读者",
  audiencePlaceholder: "一行一个，或用逗号分隔",
  hooksLabel: "商业卖点",
  hooksPlaceholder: "一行一个，例如成长、博弈、悬疑、废土感",
  constraintsLabel: "硬约束",
  constraintsPlaceholder: "一行一个，例如主角不能无代价越阶",
  submit: "创建作品并进入作品页",
};

export function CreateWorkSection({ triggerLabel = text.trigger }: CreateWorkSectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  return (
    <>
      <button type="button" className={styles.trigger} onClick={() => setIsOpen(true)}>
        {triggerLabel}
      </button>

      {isOpen ? (
        <div
          className={styles.backdrop}
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setIsOpen(false);
            }
          }}
        >
          <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId}>
            <div className={styles.header}>
              <div className={styles.headerText}>
                <h2 className={styles.title} id={titleId}>{text.title}</h2>
                <p className={styles.copy} id={descriptionId}>{text.copy}</p>
              </div>
              <button type="button" className={styles.close} onClick={() => setIsOpen(false)} aria-label={text.close}>
                {text.close}
              </button>
            </div>

            <form action={createWorkAction} className={styles.form}>
              <div className={styles.grid}>
                <label className={`${styles.field} ${styles.full}`}>
                  <span>{text.titleLabel}</span>
                  <input name="title" placeholder={text.titlePlaceholder} required />
                </label>

                <label className={styles.field}>
                  <span>{text.genreLabel}</span>
                  <input name="genre" placeholder={text.genrePlaceholder} required />
                </label>

                <label className={styles.field}>
                  <span>{text.platformLabel}</span>
                  <input name="targetPlatform" placeholder={text.platformPlaceholder} required />
                </label>

                <label className={`${styles.field} ${styles.full}`}>
                  <span>{text.taglineLabel}</span>
                  <textarea name="tagline" rows={3} placeholder={text.taglinePlaceholder} required />
                </label>
              </div>

              <details className={styles.advanced}>
                <summary>{text.advanced}</summary>
                <div className={styles.advancedContent}>
                  <label className={styles.field}>
                    <span>{text.slugLabel}</span>
                    <input name="slug" placeholder={text.slugPlaceholder} />
                  </label>
                  <label className={styles.field}>
                    <span>{text.subgenreLabel}</span>
                    <input name="subgenre" placeholder={text.subgenrePlaceholder} />
                  </label>
                  <label className={styles.field}>
                    <span>{text.targetWordCountLabel}</span>
                    <input name="targetWordCount" type="number" min={1000} defaultValue={1000000} />
                  </label>
                  <label className={styles.field}>
                    <span>{text.dailyWordTargetLabel}</span>
                    <input name="dailyWordTarget" type="number" min={0} defaultValue={4000} />
                  </label>
                  <label className={`${styles.field} ${styles.full}`}>
                    <span>{text.cadenceLabel}</span>
                    <input name="updateCadence" defaultValue={text.cadenceValue} />
                  </label>
                  <label className={`${styles.field} ${styles.full}`}>
                    <span>{text.audienceLabel}</span>
                    <textarea name="targetAudience" rows={2} placeholder={text.audiencePlaceholder} />
                  </label>
                  <label className={`${styles.field} ${styles.full}`}>
                    <span>{text.hooksLabel}</span>
                    <textarea name="commercialHooks" rows={2} placeholder={text.hooksPlaceholder} />
                  </label>
                  <label className={`${styles.field} ${styles.full}`}>
                    <span>{text.constraintsLabel}</span>
                    <textarea name="hardConstraints" rows={2} placeholder={text.constraintsPlaceholder} />
                  </label>
                </div>
              </details>

              <div className={styles.actions}>
                <button type="submit" className={styles.submit}>{text.submit}</button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}
