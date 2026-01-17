// 뜨개질 용어 프리셋
// 사용자가 선택적으로 로드할 수 있는 전문 용어 사전

import { Terminology } from '../../lib/terminology';

export const KNITTING_PRESET: Terminology = {
  terms: {
    // === 대바늘 (Knitting) ===
    // 기본 용어
    '게이지': 'gauge',
    '코': 'stitch',
    '단': 'row',
    '실': 'yarn',
    '코위찬': 'Cowichan',
    '스와치': 'swatch',

    // 기법 - 뜨기
    '겉뜨기': 'knit',
    '겉': 'knit',
    '안뜨기': 'purl',
    '안': 'purl',
    '걸러뜨기': 'slip',
    '걸러': 'slip',
    '코 줍기': 'pick up',
    '바늘비우기': 'yarn over',
    '꼬아뜨기': 'through the back loop',
    '꼬아': 'through the back loop',
    '코 잡기': 'cast on',
    '코잡기': 'cast on',
    '코 막기': 'cast off',
    '코막기': 'cast off',

    // 면/방향
    '겉면': 'right side',
    '앞면': 'right side',
    '뒷면': 'wrong side',
    '안쪽면': 'wrong side',

    // 패턴/스티치
    '도안': 'pattern',
    '꽈배기무늬': 'cable',
    '배색 컬러': 'contrasting color',
    '단수링': 'marker',
    '메리야스 뜨기': 'stockinette stitch',
    '메리야스뜨기': 'stockinette stitch',
    '고무 뜨기': 'ribbing',
    '고무뜨기': 'ribbing',

    // 기타 대바늘
    '늘림코': 'increase',
    '줄임코': 'decrease',
    '돌려뜨기': 'knitting in the round',
    '왕복뜨기': 'flat knitting',
    '돗바늘': 'tapestry needle',
    '대바늘': 'knitting needle',
    '바늘': 'needle',

    // 제품 - 대바늘
    '목도리': 'scarf',
    '모자': 'hat',
    '장갑': 'gloves',
    '손목토시': 'wrist warmers',
    '스웨터': 'sweater',
    '가디건': 'cardigan',
    '조끼': 'vest',
    '양말': 'socks',

    // === 코바늘 (Crochet) ===
    // 기본 용어
    '코수': 'stitch count',
    '단수': 'round count',
    '코바늘': 'crochet hook',

    // 기법 - 코바늘
    '사슬뜨기': 'chain stitch',
    '짧은뜨기': 'single crochet',
    '긴뜨기': 'double crochet',
    '한길긴뜨기': 'half double crochet',
    '두길긴뜨기': 'treble crochet',
    '빼뜨기': 'slip stitch',
    '마무리': 'fasten off',
    '고리만들기': 'magic ring',
    '뒤코만뜨기': 'back loop only',
    '앞코만뜨기': 'front loop only',
    '팝콘뜨기': 'popcorn stitch',
    '조개뜨기': 'shell stitch',
    '피코뜨기': 'picot stitch',

    // 제품 - 코바늘
    '인형': 'amigurumi',
    '코스터': 'coaster',
    '가방': 'bag',
    '파우치': 'pouch',
    '블랭킷': 'blanket',
    '그래니스퀘어': 'granny square',
  },
};

// 프리셋 메타데이터
export const KNITTING_PRESET_INFO = {
  id: 'knitting',
  name: '뜨개질 (대바늘 + 코바늘)',
  icon: '🧶',
  description: '대바늘과 코바늘 뜨개질 전문 용어',
  termCount: Object.keys(KNITTING_PRESET.terms).length,
};
