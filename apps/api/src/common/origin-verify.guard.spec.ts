import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { assertFromEdge } from './origin-verify.guard';

describe('assertFromEdge', () => {
  it('passes when the header matches', () => {
    expect(() => assertFromEdge('s3cret', 's3cret')).not.toThrow();
    expect(() => assertFromEdge(['s3cret'], 's3cret')).not.toThrow();
  });

  it.each([undefined, '', 'wrong', 's3cre', 's3cret!'])('rejects %p', (provided) => {
    expect(() => assertFromEdge(provided, 's3cret')).toThrow(UnauthorizedException);
  });

  it('fails closed when no secret is configured', () => {
    expect(() => assertFromEdge('anything', '')).toThrow(ServiceUnavailableException);
  });
});
