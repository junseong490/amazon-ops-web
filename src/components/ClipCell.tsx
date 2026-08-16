// 텍스트 표 셀: 최대폭 초과 시 말줄임(ellipsis) 축약, hover 시 title로 전체 이름 노출.
// 표 오버플로 방지용(품목명/마켓명 등 긴 라벨). 숫자 열에는 쓰지 않는다.
interface Props {
  text: string;
  /** col-name(기본) | col-key(보조 식별자, muted 스타일) */
  variant?: 'name' | 'key';
}

export function ClipCell({ text, variant = 'name' }: Props) {
  return (
    <td className={variant === 'key' ? 'col-key' : 'col-name'}>
      <span className="cell-clip" title={text}>
        {text}
      </span>
    </td>
  );
}
