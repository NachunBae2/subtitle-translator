interface FooterProps {
  apiKeySet: boolean;
}

export function Footer({ apiKeySet }: FooterProps) {
  return (
    <footer className="footer">
      <p>
        <span>API 키: {apiKeySet ? '✓ 연결됨' : '✗ 미설정'}</span>
      </p>
    </footer>
  );
}
