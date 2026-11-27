import { normalizeChildGender } from "../../utils/child-gender";

const AVATAR_SRC: Record<"male" | "female" | "neutral", string> = {
  male: "/static/images/kid-info/avatar_boy.png",
  female: "/static/images/kid-info/avatar_girl.png",
  neutral: "/static/images/kid-info/avatar_neutral.png",
};

const NEUTRAL_LABEL = "默认孩子头像";

function resolveAvatar(gender?: string | null) {
  const normalized = normalizeChildGender(gender);
  return {
    avatarSrc: AVATAR_SRC[normalized ?? "neutral"],
    label:
      normalized === "male"
        ? "男孩头像"
        : normalized === "female"
          ? "女孩头像"
          : NEUTRAL_LABEL,
    failed: false,
  };
}

/**
 * 孩子头像：按性别展示男孩/女孩图片，未设置或未知性别回落包内中性头像。
 * 图片加载失败时保留灰圆底，不循环重试。
 */
Component({
  options: {
    addGlobalClass: true,
  },
  properties: {
    /** male / female；历史写法 m/f、男/女 也兼容 */
    gender: {
      type: String,
      value: "",
    },
    /** 直径，单位 rpx */
    size: {
      type: Number,
      value: 88,
    },
  },
  data: {
    avatarSrc: AVATAR_SRC.neutral,
    label: NEUTRAL_LABEL,
    failed: false,
  },
  lifetimes: {
    attached() {
      this.setData(resolveAvatar(this.data.gender));
    },
  },
  observers: {
    gender(value: string) {
      this.setData(resolveAvatar(value));
    },
  },
  methods: {
    onImageError() {
      this.setData({ failed: true });
    },
  },
});
